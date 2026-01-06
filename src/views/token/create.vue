<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import {
  getMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} from '@solana/spl-token';
import {
  PlusOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  GlobalOutlined,
  WalletOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue';
import { useWallet } from '../../hooks/useWallet';
import { addTokenMint } from '../../composables/useTokenMints';

const { t } = useI18n();

// 使用钱包Hook
const walletContext = useWallet();
const walletState = walletContext.walletState;
const connection = computed(() => walletContext.connection.value);
const network = walletContext.network;

// 代币信息
const tokenName = ref('');
const tokenSymbol = ref('');
const tokenDecimals = ref(9);
const keepMintAuthority = ref(true);
const keepFreezeAuthority = ref(true);

// 状态
const creating = ref(false);
const createdTokenMint = ref('');
const createdTokenInfo = ref<{
  mint: string;
  decimals: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
} | null>(null);

// 验证函数
const isFormValid = computed(() => {
  return tokenName.value.trim() !== '' &&
    tokenSymbol.value.trim() !== '' &&
    tokenDecimals.value >= 0 &&
         tokenDecimals.value <= 9 && 
    walletState.value?.connected &&
    walletState.value?.publicKey !== null;
});

  // 创建代币
  const createToken = async () => {
    // 先检查表单基本验证（名称和符号）
    if (!tokenName.value.trim() || !tokenSymbol.value.trim()) {
      message.error(t('createToken.nameRequired'));
      return;
    }

    // 放宽检查：只需要 connected 和 publicKey，不强制要求 wallet 实例
    // 因为钱包可能在页面刷新后重连，但适配器实例可能不同步
    // 我们会在实际发送交易时使用 fallback 机制
    if (!walletState.value?.connected || !walletState.value?.publicKey) {
      message.error(t('wallet.connectWallet'));
      return;
    }

    const publicKey = walletState.value.publicKey;
    // wallet 可能为空，但我们在发送交易时有 fallback 机制
    const wallet = walletState.value?.wallet;
    
    // 确保钱包适配器有 publicKey（对于某些钱包适配器，可能需要从 walletState 获取）
    // 注意：某些钱包适配器的 publicKey 是只读的，所以这里只是检查
    // 如果 wallet.publicKey 不存在，我们仍然可以使用 publicKey 变量
    
    creating.value = true;
    
    try {
      const conn = connection.value;

    // 创建新的密钥对作为代币 mint 地址
    const mintKeypair = Keypair.generate();
    const mintPublicKey = mintKeypair.publicKey;

    // 获取所需的最小租金
    const lamports = await getMinimumBalanceForRentExemptMint(conn);

    // 创建交易
    const transaction = new Transaction();
    
    // 添加创建账户指令
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: publicKey,
        newAccountPubkey: mintPublicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      })
    );
    
    // 初始化 mint（mintAuthority 不能为 null，所以总是设置为 publicKey）
    transaction.add(
      createInitializeMintInstruction(
        mintPublicKey,
        tokenDecimals.value,
        publicKey, // mintAuthority 必须是一个有效的 PublicKey
        keepFreezeAuthority.value ? publicKey : null, // freezeAuthority 可以为 null
        TOKEN_PROGRAM_ID
      )
    );
    
    // 如果不需要保留 mintAuthority，在创建后立即移除
    if (!keepMintAuthority.value) {
      transaction.add(
        createSetAuthorityInstruction(
          mintPublicKey,
          publicKey, // 当前权限持有者
          AuthorityType.MintTokens,
          null, // 设置为 null 以移除权限
          undefined, // multiSigners
          TOKEN_PROGRAM_ID
        )
      );
    }

    // 获取最近的区块哈希
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    // 部分签名（mint 账户需要签名）
    transaction.partialSign(mintKeypair);

    // 尝试发送交易
    let signature: string;
    
    try {
      // 方法1: 直接发送（标准方式）
      if (typeof wallet.sendTransaction === 'function') {
        signature = await wallet.sendTransaction(transaction, conn);
      } else if (typeof wallet.signTransaction === 'function') {
        // 方法2: 先签名再发送
        const signedTransaction = await wallet.signTransaction(transaction);
        signature = await conn.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
      } else {
        throw new Error('钱包适配器不支持发送交易');
      }
    } catch (sendError: any) {
      // 如果错误是 WalletNotConnectedError，提示用户连接钱包
      if (sendError.message?.includes('WalletNotConnectedError') || 
          sendError.message?.includes('not connected') || 
          sendError.message?.includes('Wallet not connected')) {
        throw new Error('WalletNotConnectedError');
      }
      
      // 如果直接发送失败，尝试先签名再发送
      if (typeof wallet.signTransaction === 'function') {
        try {
          const signedTransaction = await wallet.signTransaction(transaction);
          signature = await conn.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });
        } catch (signError: any) {
          throw sendError; // 抛出原始错误
        }
      } else {
        throw sendError; // 抛出原始错误
      }
    }

    // 等待确认
    const confirmation = await conn.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`交易确认失败: ${JSON.stringify(confirmation.value.err)}`);
    }

    const mintAddress = mintPublicKey.toString();
    createdTokenMint.value = mintAddress;

    // 获取代币信息
    try {
      const mintInfo = await getMint(conn, mintPublicKey);
      createdTokenInfo.value = {
        mint: mintAddress,
        decimals: mintInfo.decimals,
        mintAuthority: mintInfo.mintAuthority?.toString() || null,
        freezeAuthority: mintInfo.freezeAuthority?.toString() || null,
      };
    } catch (error) {
      // 获取代币信息失败，静默处理
    }

    // 保存 Mint 地址到本地存储
    addTokenMint(mintAddress, tokenName.value || undefined, tokenSymbol.value || undefined);

    message.success(t('createToken.createSuccess'));

    // 清空表单
    tokenName.value = '';
    tokenSymbol.value = '';
  } catch (error: any) {
    // 改进错误提示
    let errorMessage = t('common.error');
    
    if (error.message) {
      errorMessage = error.message;
    } else if (error.toString && error.toString() !== '[object Object]') {
      errorMessage = error.toString();
    }
    
    // 检查常见的错误类型
    if (errorMessage.includes('User rejected') || errorMessage.includes('rejected')) {
      message.warning(t('createToken.userCancelled'));
    } else if (errorMessage.includes('WalletNotConnectedError') || errorMessage.includes('not connected') || errorMessage.includes('Wallet not connected') || errorMessage.includes('钱包未连接')) {
      // 如果是钱包未连接错误，只显示连接钱包提示，不显示"创建代币失败"
      message.error(t('wallet.connectWallet'));
    } else if (errorMessage.includes('insufficient funds') || errorMessage.includes('Insufficient')) {
      message.error(`${t('createToken.createFailed')}: ${t('wallet.insufficientFunds') || '余额不足'}`);
    } else if (errorMessage.includes('Network') || errorMessage.includes('network')) {
      message.error(`${t('createToken.createFailed')}: ${t('wallet.networkError') || '网络错误'}`);
    } else if (errorMessage.includes('Transaction') || errorMessage.includes('transaction')) {
      message.error(`${t('createToken.createFailed')}: ${t('wallet.transactionError') || '交易失败'}`);
    } else {
      message.error(`${t('createToken.createFailed')}: ${errorMessage}`);
    }
  } finally {
    creating.value = false;
  }
};

// 复制地址
const copyAddress = (address: string) => {
  navigator.clipboard.writeText(address)
    .then(() => {
      message.success(t('wallet.addressCopied'));
    })
    .catch(() => {
      message.error(t('common.error'));
    });
};

// 在Solscan查看
const viewOnSolscan = (mint: string) => {
  const cluster = network.value === 'mainnet' ? '' : `?cluster=${network.value}`;
  window.open(`https://solscan.io/token/${mint}${cluster}`, '_blank');
};

// 格式化地址
const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
};

// 重置表单
const resetForm = () => {
  createdTokenMint.value = '';
  createdTokenInfo.value = null;
  tokenName.value = '';
  tokenSymbol.value = '';
  tokenDecimals.value = 9;
  keepMintAuthority.value = true;
  keepFreezeAuthority.value = true;
};

// 导航到铸造页面
const navigateToMint = () => {
  if (createdTokenMint.value) {
    // 将 mint 地址存储到 localStorage，供铸造页面使用
    localStorage.setItem('mint-token-address', createdTokenMint.value);
    // 触发自定义事件，通知 App.vue 切换页面
    window.dispatchEvent(new CustomEvent('navigate-to', { detail: { key: 'mint-token' } }));
  }
};

// 监听钱包连接状态
watch(() => walletState.value?.connected, (isConnected) => {
  if (!isConnected) {
    resetForm();
  }
});

// 默认导出
defineOptions({
  name: 'TokenCreate',
});
</script>

<template>
  <div class="p-0 w-full max-w-full animate-[fadeIn_0.3s_ease-in] min-h-full flex flex-col">
    <!-- 未连接钱包提示 -->
    <div v-if="!walletState || !walletState.connected" class="flex items-center justify-center min-h-[400px] flex-1">
      <div class="text-center">
        <div class="mb-6 animate-bounce">
          <WalletOutlined class="text-6xl text-white/30" />
        </div>
        <h3 class="text-2xl font-bold text-white mb-2">{{ t('createToken.connectWalletFirst') }}</h3>
        <p class="text-white/60">{{ t('createToken.connectWalletDesc') }}</p>
      </div>
    </div>

    <!-- 成功状态 -->
    <div v-else-if="createdTokenMint" class="flex-1 flex flex-col min-h-0 py-3">
      <div
        class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border-2 border-[rgba(82,196,26,0.3)] rounded-2xl p-6 overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(82,196,26,0.5)] hover:shadow-[0_20px_40px_rgba(82,196,26,0.2)]">
        <div
          class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
        </div>
        <div class="relative z-[1]">
          <div class="flex items-center gap-3 mb-6">
            <CheckCircleOutlined class="text-3xl text-[#52c41a]" />
            <div>
              <h3 class="m-0 text-xl font-semibold text-white">{{ t('createToken.createSuccess') }}</h3>
              <p class="m-0 text-sm text-white/60 mt-1">{{ t('createToken.successMessage') }}</p>
            </div>
          </div>

          <div class="space-y-4">
            <!-- Mint 地址 -->
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-medium text-white/80">{{ t('setMetadata.successMintAddress') }}</span>
              </div>
              <div class="flex items-center gap-2">
                <div
                  class="flex-1 px-4 py-2.5 bg-white/5 rounded-lg border border-white/10 text-sm font-mono text-white/90 break-all">
                  {{ createdTokenMint }}
                </div>
                <a-button @click="copyAddress(createdTokenMint)"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                  {{ t('common.copy') }}
                </a-button>
                <a-button @click="viewOnSolscan(createdTokenMint)"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <GlobalOutlined />
                  </template>
                  {{ t('setMetadata.viewOnSolscan') }}
                </a-button>
              </div>
            </div>

            <!-- 代币信息 -->
            <div v-if="createdTokenInfo" class="grid grid-cols-2 gap-4">
              <div class="bg-white/5 rounded-xl p-4 border border-white/10">
                <div class="text-xs font-medium text-white/60 mb-1">{{ t('createToken.decimals') }}</div>
                <div class="text-base font-semibold text-white">{{ createdTokenInfo.decimals }}</div>
              </div>
              <div class="bg-white/5 rounded-xl p-4 border border-white/10">
                <div class="text-xs font-medium text-white/60 mb-1">{{ t('createToken.keepMintAuthority') }}</div>
                <div class="text-sm font-mono text-white/90 truncate">
                  {{ createdTokenInfo.mintAuthority ? formatAddress(createdTokenInfo.mintAuthority) : t('common.cancel') }}
                </div>
              </div>
              <div class="bg-white/5 rounded-xl p-4 border border-white/10">
                <div class="text-xs font-medium text-white/60 mb-1">{{ t('createToken.keepFreezeAuthority') }}</div>
                <div class="text-sm font-mono text-white/90 truncate">
                  {{ createdTokenInfo.freezeAuthority ? formatAddress(createdTokenInfo.freezeAuthority) : t('common.cancel') }}
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex gap-3 pt-4">
              <a-button @click="resetForm"
                class="flex-1 flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-2.5 h-auto text-[15px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300">
                <template #icon>
                  <PlusOutlined />
                </template>
                {{ t('createToken.create') }}
              </a-button>
              <a-button @click="navigateToMint"
                class="flex-1 flex items-center justify-center bg-white/10 border border-white/20 text-white px-6 py-2.5 h-auto text-[15px] hover:bg-white/15 hover:border-white/30 transition-all duration-300">
                <template #icon>
                  <ToolOutlined />
                </template>
                {{ t('header.mintToken') }}
        </a-button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 创建表单 -->
    <div v-else class="w-full py-3">
      <div
        class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border border-white/10 rounded-2xl p-6 overflow-visible transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(20,241,149,0.3)] hover:shadow-[0_8px_32px_rgba(20,241,149,0.15)]">
        <div
          class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
        </div>
        <div class="relative z-[1] space-y-6">
          <!-- 代币名称 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('createToken.name') }} <span class="text-red-400">*</span>
            </label>
            <a-input v-model:value="tokenName" :placeholder="t('createToken.namePlaceholder')" size="large"
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl"
              :class="{ '!border-solana-green': tokenName }" />
            <div class="mt-1.5 text-xs text-white/50">{{ t('createToken.name') }}</div>
          </div>
      
          <!-- 代币符号 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('createToken.symbol') }} <span class="text-red-400">*</span>
            </label>
            <a-input v-model:value="tokenSymbol" :placeholder="t('createToken.symbolPlaceholder')" size="large"
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl uppercase"
              :class="{ '!border-solana-green': tokenSymbol }" :maxlength="10" />
            <div class="mt-1.5 text-xs text-white/50">{{ t('createToken.symbol') }}</div>
          </div>
      
          <!-- 小数位数 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('createToken.decimals') }} <span class="text-red-400">*</span>
            </label>
            <a-input-number v-model:value="tokenDecimals" :min="0" :max="9" size="large"
              class="w-full bg-white/5 border-white/20 text-white rounded-xl"
              :class="{ '!border-solana-green': tokenDecimals >= 0 }" />
            <div class="mt-1.5 text-xs text-white/50">{{ t('createToken.decimalsPlaceholder') }}</div>
          </div>

          <!-- 权限设置 -->
          <div class="space-y-4">
            <div class="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
              <a-checkbox v-model:checked="keepMintAuthority" class="!text-white" />
              <div class="flex-1">
                <div class="text-sm font-medium text-white/90 mb-1">{{ t('createToken.keepMintAuthority') }}</div>
                <div class="text-xs text-white/50">{{ t('createToken.keepMintAuthority') }}</div>
              </div>
            </div>

            <div class="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
              <a-checkbox v-model:checked="keepFreezeAuthority" class="!text-white" />
              <div class="flex-1">
                <div class="text-sm font-medium text-white/90 mb-1">{{ t('createToken.keepFreezeAuthority') }}</div>
                <div class="text-xs text-white/50">{{ t('createToken.keepFreezeAuthority') }}</div>
              </div>
            </div>
          </div>

          <!-- 提示信息 -->
          <div
            class="flex items-start gap-3 p-4 bg-[rgba(20,241,149,0.1)] rounded-xl border border-[rgba(20,241,149,0.2)]">
            <InfoCircleOutlined class="text-solana-green text-lg shrink-0 mt-0.5" />
            <div class="flex-1">
              <div class="text-sm font-medium text-solana-green mb-1">{{ t('createToken.createTip') }}</div>
              <div class="text-xs text-white/70">
                <ul class="m-0 pl-4 space-y-1">
                  <li>{{ t('createToken.createTip1') }}</li>
                  <li>{{ t('createToken.createTip2') }}</li>
                  <li>{{ t('createToken.createTip3') }}</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- 创建按钮 -->
          <div class="pt-2">
            <a-button type="primary" :loading="creating" :disabled="!isFormValid" @click="createToken" size="large"
              block
              class="flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-3 h-auto text-[16px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
              <template #icon>
                <PlusOutlined />
              </template>
              {{ creating ? t('createToken.creating') : t('createToken.create') }}
        </a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 输入框样式覆盖 */
:deep(.ant-input),
:deep(.ant-input-number-input) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-input:focus),
:deep(.ant-input-focused),
:deep(.ant-input-number-focused .ant-input-number-input) {
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-color: #14f195 !important;
  box-shadow: 0 0 0 2px rgba(20, 241, 149, 0.2) !important;
}

:deep(.ant-input::placeholder) {
  color: rgba(255, 255, 255, 0.4) !important;
}

:deep(.ant-input-number-handler-wrap) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

:deep(.ant-input-number-handler) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.ant-input-number-handler:hover) {
  color: rgba(255, 255, 255, 1) !important;
}

/* 复选框样式覆盖 */
:deep(.ant-checkbox-wrapper) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-checkbox-inner) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
}

:deep(.ant-checkbox-checked .ant-checkbox-inner) {
  background-color: #14f195 !important;
  border-color: #14f195 !important;
}

:deep(.ant-checkbox-checked .ant-checkbox-inner::after) {
  border-color: #0b1329 !important;
}

/* 按钮样式覆盖 */
:deep(.ant-btn-primary:disabled) {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.4) !important;
}
</style> 
