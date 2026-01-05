<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createMintToCheckedInstruction,
} from '@solana/spl-token';
import {
  ToolOutlined,
  CopyOutlined,
  InfoCircleOutlined,
  WalletOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  GlobalOutlined,
} from '@ant-design/icons-vue';
import { useWallet } from '../../hooks/useWallet';

const { t } = useI18n();

// 使用钱包Hook
const walletContext = useWallet();
const walletState = walletContext.walletState;
const connection = computed(() => walletContext.connection.value);
const network = walletContext.network;

// 代币Mint地址
const tokenMintAddress = ref('');
const decimals = ref(9);
const mintAmount = ref('');
const targetWalletAddress = ref('');
const mintToCurrentWallet = ref(true);

// 状态
const minting = ref(false);
const loadingInfo = ref(false);
const loadingBalance = ref(false);
const currentBalance = ref(0);
const tokenInfo = ref<{
  decimals: number;
  supply: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
} | null>(null);

// 验证Solana地址格式
const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};

// 验证函数
const isFormValid = computed(() => {
  const hasMintAddress = tokenMintAddress.value.trim() !== '';
  const hasAmount = mintAmount.value && parseFloat(mintAmount.value) > 0;
  const isConnected = walletState.value?.connected && walletState.value?.publicKey !== null;
  
  // 如果铸造到指定地址，需要验证地址格式
  if (!mintToCurrentWallet.value) {
    const hasValidTargetAddress = targetWalletAddress.value.trim() !== '' && 
      isValidSolanaAddress(targetWalletAddress.value);
    return hasMintAddress && hasAmount && isConnected && hasValidTargetAddress;
  }
  
  return hasMintAddress && hasAmount && isConnected;
});

// 格式化地址
const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
};

// 获取代币信息
const fetchTokenInfo = async () => {
  if (!tokenMintAddress.value.trim()) {
    return;
  }

  if (!walletState.value?.connected) {
    return;
  }

  loadingInfo.value = true;
  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const mintInfo = await getMint(connection.value, mintPubkey);

    tokenInfo.value = {
      decimals: mintInfo.decimals,
      supply: mintInfo.supply.toString(),
      mintAuthority: mintInfo.mintAuthority?.toString() || null,
      freezeAuthority: mintInfo.freezeAuthority?.toString() || null,
    };

    decimals.value = mintInfo.decimals;
  } catch (error: any) {
    message.error(`${t('mintToken.mintFailed')}: ${error.message || t('mintToken.mintAddressRequired')}`);
    tokenInfo.value = null;
  } finally {
    loadingInfo.value = false;
  }
};

// 获取当前余额
const fetchCurrentBalance = async () => {
  if (!tokenMintAddress.value || !walletState.value?.publicKey) {
    return;
  }

  loadingBalance.value = true;
  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const ownerPubkey = walletState.value.publicKey;

    // 获取或创建关联代币账户
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection.value,
      walletState.value.wallet!,
      mintPubkey,
      ownerPubkey
    );

    currentBalance.value = Number(tokenAccount.amount) / Math.pow(10, decimals.value);
  } catch (error: any) {
    message.error(`${t('common.error')}: ${error.message || t('common.error')}`);
    currentBalance.value = 0;
  } finally {
    loadingBalance.value = false;
  }
};

// 铸造代币
const handleMint = async () => {
  if (!isFormValid.value) {
    message.error(t('mintToken.mintAddressRequired'));
    return;
  }

  if (!walletState.value?.connected || !walletState.value?.publicKey) {
    message.error(t('wallet.connectWallet'));
    return;
  }

  if (!walletState.value?.wallet) {
    message.error(t('wallet.connectWallet'));
    return;
  }

  minting.value = true;

  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const payerPubkey = walletState.value.publicKey; // 支付者（当前连接的钱包）
    const wallet = walletState.value.wallet;
    const conn = connection.value;

    // 确定目标钱包地址
    let targetPubkey: PublicKey;
    if (mintToCurrentWallet.value) {
      targetPubkey = payerPubkey;
    } else {
      if (!targetWalletAddress.value.trim()) {
        message.error(t('mintToken.targetAddressRequired'));
        return;
      }
      if (!isValidSolanaAddress(targetWalletAddress.value)) {
        message.error(t('mintToken.addressInvalid'));
        return;
      }
      targetPubkey = new PublicKey(targetWalletAddress.value);
    }

    // 获取关联代币账户地址
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mintPubkey,
      targetPubkey
    );

    // 检查账户是否存在
    let tokenAccountExists = false;
    try {
      await getAccount(conn, associatedTokenAddress);
      tokenAccountExists = true;
    } catch (error: any) {
      // 账户不存在，需要创建
      tokenAccountExists = false;
    }

    // 创建交易
    const transaction = new Transaction();

    // 如果账户不存在，添加创建账户的指令
    if (!tokenAccountExists) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payerPubkey, // payer (支付创建账户的费用)
          associatedTokenAddress, // ata
          targetPubkey, // owner (账户所有者)
          mintPubkey // mint
        )
      );
    }

    // 计算铸造数量(考虑小数位)
    const amountToMint = Math.floor(parseFloat(mintAmount.value) * Math.pow(10, decimals.value));

    // 添加铸造指令
    // 注意：mint authority 必须是当前连接的钱包（拥有铸币权限的地址）
    transaction.add(
      createMintToCheckedInstruction(
        mintPubkey,
        associatedTokenAddress,
        payerPubkey, // mint authority (必须是拥有铸币权限的地址)
        amountToMint,
        decimals.value
      )
    );

    // 获取最近的区块哈希
    const { blockhash } = await conn.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payerPubkey;

    // 发送并确认交易
    const signature = await wallet.sendTransaction(transaction, conn);
    await conn.confirmTransaction(signature, 'confirmed');

    message.success(t('mintToken.mintSuccess'));

    // 刷新余额和代币信息
    await fetchCurrentBalance();
    await fetchTokenInfo();

    // 清空铸造数量
    mintAmount.value = '';
  } catch (error: any) {
    console.error('铸造代币失败:', error);
    
    // 改进错误提示
    if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
      message.warning(t('mintToken.userCancelled') || t('createToken.userCancelled'));
    } else if (error.message?.includes('TokenAccountNotFoundError')) {
      message.error(t('mintToken.mintFailed'));
    } else {
      message.error(`${t('mintToken.mintFailed')}: ${error.message || t('common.error')}`);
    }
  } finally {
    minting.value = false;
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

// 监听Mint地址变化
watch(() => tokenMintAddress.value, (newValue) => {
  if (newValue && newValue.trim()) {
    fetchTokenInfo();
    if (walletState.value?.connected) {
      fetchCurrentBalance();
    }
  } else {
    tokenInfo.value = null;
    currentBalance.value = 0;
  }
});

// 监听钱包连接状态
watch(() => walletState.value?.connected, (isConnected) => {
  if (isConnected && tokenMintAddress.value) {
    fetchCurrentBalance();
  } else {
    currentBalance.value = 0;
  }
});

// 组件挂载时从 localStorage 读取 mint 地址
onMounted(() => {
  const savedMintAddress = localStorage.getItem('mint-token-address');
  if (savedMintAddress) {
    tokenMintAddress.value = savedMintAddress;
    // 清除 localStorage 中的地址，避免下次进入时自动填充
    localStorage.removeItem('mint-token-address');
  }
});

// 默认导出
defineOptions({
  name: 'MintToken',
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
        <h3 class="text-2xl font-bold text-white mb-2">{{ t('wallet.connectWallet') }}</h3>
        <p class="text-white/60">{{ t('header.mintToken') }}</p>
      </div>
    </div>

    <!-- 铸造表单 -->
    <div v-else class="w-full py-3">
      <div
        class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border border-white/10 rounded-2xl p-6 overflow-visible transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(20,241,149,0.3)] hover:shadow-[0_8px_32px_rgba(20,241,149,0.15)]">
        <div
          class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
        </div>
        <div class="relative z-[1] space-y-6">
          <!-- Mint 地址 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('mintToken.mintAddress') }} <span class="text-red-400">*</span>
            </label>
            <a-input
              v-model:value="tokenMintAddress"
              :placeholder="t('mintToken.mintAddressPlaceholder')"
              size="large"
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl font-mono"
              :class="{ '!border-solana-green': tokenMintAddress }"
            />
            <div class="mt-1.5 text-xs text-white/50">{{ t('mintToken.mintAddress') }}</div>
          </div>

          <!-- 代币信息显示 -->
          <div v-if="tokenInfo" class="space-y-4">
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <h3 class="m-0 text-base font-semibold text-white">{{ t('tokenList.title') }}</h3>
                <a-button
                  @click="fetchTokenInfo"
                  :loading="loadingInfo"
                  size="small"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-3 py-1 text-xs font-medium rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <ReloadOutlined />
                  </template>
                  {{ t('common.loading') }}
                </a-button>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">小数位数</div>
                  <div class="text-base font-semibold text-white">{{ tokenInfo.decimals }}</div>
                </div>
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">当前供应量</div>
                  <div class="text-sm font-semibold text-white truncate">
                    {{ (Number(tokenInfo.supply) / Math.pow(10, tokenInfo.decimals)).toLocaleString() }}
                  </div>
                </div>
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">铸币权限</div>
                  <div class="text-xs font-mono text-white/90 truncate">
                    {{ tokenInfo.mintAuthority ? formatAddress(tokenInfo.mintAuthority) : '无' }}
                  </div>
                </div>
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">冻结权限</div>
                  <div class="text-xs font-mono text-white/90 truncate">
                    {{ tokenInfo.freezeAuthority ? formatAddress(tokenInfo.freezeAuthority) : '无' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 当前余额 -->
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-white/80">当前余额</span>
                <a-button
                  @click="fetchCurrentBalance"
                  :loading="loadingBalance"
                  size="small"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-3 py-1 text-xs font-medium rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <ReloadOutlined />
                  </template>
                  刷新
                </a-button>
              </div>
              <div class="text-2xl font-bold text-solana-green">
                {{ currentBalance.toLocaleString(undefined, { maximumFractionDigits: decimals }) }}
              </div>
            </div>
          </div>

          <!-- 铸造目标 -->
          <div class="space-y-4">
            <div class="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
              <a-checkbox
                v-model:checked="mintToCurrentWallet"
                class="!text-white"
              />
              <div class="flex-1">
                <div class="text-sm font-medium text-white/90 mb-1">{{ t('mintToken.mintToCurrentWallet') }}</div>
                <div class="text-xs text-white/50">{{ t('mintToken.mintToCurrentWallet') }}</div>
                <div v-if="walletState?.publicKey" class="text-xs text-white/40 mt-1 font-mono">
                  {{ formatAddress(walletState.publicKey?.toString() || '') }}
                </div>
              </div>
            </div>

            <div v-if="!mintToCurrentWallet">
              <label class="block text-sm font-medium text-white/90 mb-2">
                {{ t('mintToken.targetWalletAddress') }} <span class="text-red-400">*</span>
              </label>
              <a-input
                v-model:value="targetWalletAddress"
                :placeholder="t('mintToken.targetWalletAddressPlaceholder')"
                size="large"
                class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl font-mono"
                :class="{ '!border-solana-green': targetWalletAddress && isValidSolanaAddress(targetWalletAddress), '!border-red-500': targetWalletAddress && !isValidSolanaAddress(targetWalletAddress) }"
              />
              <div class="mt-1.5 text-xs text-white/50">
                {{ t('mintToken.targetWalletAddress') }}
              </div>
              <div v-if="targetWalletAddress && !isValidSolanaAddress(targetWalletAddress)" class="mt-1.5 text-xs text-red-400">
                {{ t('mintToken.addressInvalid') }}
              </div>
            </div>
          </div>

          <!-- 铸造数量 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('mintToken.amount') }} <span class="text-red-400">*</span>
            </label>
            <a-input-number
              v-model:value="mintAmount"
              :min="0"
              :precision="decimals"
              :step="Math.pow(10, -decimals)"
              size="large"
              class="w-full bg-white/5 border-white/20 text-white rounded-xl"
              :class="{ '!border-solana-green': mintAmount }"
              placeholder="请输入要铸造的数量"
            />
            <div class="mt-1.5 text-xs text-white/50">最多支持 {{ decimals }} 位小数</div>
          </div>

          <!-- 提示信息 -->
          <div
            class="flex items-start gap-3 p-4 bg-[rgba(20,241,149,0.1)] rounded-xl border border-[rgba(20,241,149,0.2)]">
            <InfoCircleOutlined class="text-solana-green text-lg shrink-0 mt-0.5" />
            <div class="flex-1">
              <div class="text-sm font-medium text-solana-green mb-1">铸造提示</div>
              <div class="text-xs text-white/70">
                <ul class="m-0 pl-4 space-y-1">
                  <li>只有拥有铸币权限(Mint Authority)的地址才能铸造代币</li>
                  <li>铸造的代币将发送到指定钱包的关联代币账户(ATA)</li>
                  <li>如果目标账户不存在，系统会自动创建（需要支付账户创建费用）</li>
                  <li>请确保您有足够的 SOL 支付交易手续费和账户创建费用</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- 铸造按钮 -->
          <div class="pt-2">
            <a-button
              type="primary"
              :loading="minting"
              :disabled="!isFormValid"
              @click="handleMint"
              size="large"
              block
              class="flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-3 h-auto text-[16px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
              <template #icon>
                <ToolOutlined />
              </template>
              {{ minting ? t('mintToken.minting') : t('mintToken.mint') }}
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

/* 按钮样式覆盖 */
:deep(.ant-btn-primary:disabled) {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.4) !important;
}
</style>
