<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  getAccount,
  getMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from '@solana/spl-token';
import {
  SendOutlined,
  CopyOutlined,
  InfoCircleOutlined,
  WalletOutlined,
  ReloadOutlined,
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
const recipientAddress = ref('');
const transferAmount = ref('');

// 状态
const transferring = ref(false);
const loadingInfo = ref(false);
const loadingBalance = ref(false);
const decimals = ref(9);
const senderBalance = ref(0);
const tokenInfo = ref<{
  decimals: number;
  supply: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
} | null>(null);
const senderATA = ref('');

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
  const hasRecipient = recipientAddress.value.trim() !== '' && isValidSolanaAddress(recipientAddress.value);
  const hasAmount = transferAmount.value && parseFloat(transferAmount.value) > 0;
  const isConnected = walletState.value?.connected && walletState.value?.publicKey !== null;
  const hasEnoughBalance = parseFloat(transferAmount.value || '0') <= senderBalance.value;
  
  return hasMintAddress && hasRecipient && hasAmount && isConnected && hasEnoughBalance;
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
    await fetchSenderBalance();
  } catch (error: any) {
    message.error(`获取代币信息失败: ${error.message || '请检查Mint地址'}`);
    tokenInfo.value = null;
  } finally {
    loadingInfo.value = false;
  }
};

// 获取发送者余额
const fetchSenderBalance = async () => {
  if (!tokenMintAddress.value || !walletState.value?.publicKey) {
    return;
  }

  loadingBalance.value = true;
  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const ownerPubkey = walletState.value.publicKey;

    // 获取关联代币账户地址
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mintPubkey,
      ownerPubkey
    );

    senderATA.value = associatedTokenAddress.toString();

    // 获取账户余额
    try {
      const accountInfo = await getAccount(connection.value, associatedTokenAddress);
      senderBalance.value = Number(accountInfo.amount) / Math.pow(10, decimals.value);
    } catch (error: any) {
      // 账户不存在
      senderBalance.value = 0;
      senderATA.value = '';
    }
  } catch (error: any) {
    message.error(`获取余额失败: ${error.message || '未知错误'}`);
    senderBalance.value = 0;
  } finally {
    loadingBalance.value = false;
  }
};

// 转账代币
const handleTransfer = async () => {
  if (!isFormValid.value) {
    message.error(t('transferToken.recipientAddressRequired'));
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

  // 验证接收地址
  if (!isValidSolanaAddress(recipientAddress.value)) {
    message.error(t('transferToken.addressInvalid'));
    return;
  }

  // 检查余额
  if (parseFloat(transferAmount.value) > senderBalance.value) {
    message.error(t('transferToken.insufficientBalance'));
    return;
  }

  transferring.value = true;

  try {
    // 再次检查钱包状态（防止在操作过程中断开连接）
    if (!walletState.value?.connected || !walletState.value?.publicKey) {
      message.error(t('wallet.connectWallet'));
      return;
    }

    if (!walletState.value?.wallet) {
      message.error(t('wallet.connectWallet'));
      return;
    }

    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const recipientPubkey = new PublicKey(recipientAddress.value);
    const senderPubkey = walletState.value.publicKey!;
    const wallet = walletState.value.wallet;
    const conn = connection.value;

    // 验证钱包适配器是否有效
    if (!wallet || typeof wallet.sendTransaction !== 'function') {
      message.error(t('wallet.connectWallet'));
      return;
    }

    // 检查钱包适配器的连接状态
    if (wallet.connected === false || !wallet.publicKey) {
      message.error(t('wallet.connectWallet'));
      return;
    }

    // 获取发送者的关联代币账户地址
    const senderATAAddress = await getAssociatedTokenAddress(
      mintPubkey,
      senderPubkey
    );

    // 获取接收者的关联代币账户地址
    const recipientATAAddress = await getAssociatedTokenAddress(
      mintPubkey,
      recipientPubkey
    );

    // 检查接收者账户是否存在
    let recipientAccountExists = false;
    try {
      await getAccount(conn, recipientATAAddress);
      recipientAccountExists = true;
    } catch (error: any) {
      recipientAccountExists = false;
    }

    // 创建交易
    const transaction = new Transaction();

    // 如果接收者账户不存在，添加创建账户的指令
    if (!recipientAccountExists) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          senderPubkey, // payer (发送者支付创建账户的费用)
          recipientATAAddress, // ata
          recipientPubkey, // owner (接收者)
          mintPubkey // mint
        )
      );
    }

    // 计算转账数量(考虑小数位)
    const amountToTransfer = Math.floor(parseFloat(transferAmount.value) * Math.pow(10, decimals.value));

    // 添加转账指令
    transaction.add(
      createTransferCheckedInstruction(
        senderATAAddress, // source
        mintPubkey, // mint
        recipientATAAddress, // destination
        senderPubkey, // owner (发送者)
        amountToTransfer,
        decimals.value
      )
    );

    // 获取最近的区块哈希
    const { blockhash } = await conn.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderPubkey;

    // 发送并确认交易
    const signature = await wallet.sendTransaction(transaction, conn);
    await conn.confirmTransaction(signature, 'confirmed');

    message.success(t('transferToken.transferSuccess'));

    // 刷新余额和代币信息
    await fetchSenderBalance();
    await fetchTokenInfo();

    // 清空表单
    transferAmount.value = '';
    recipientAddress.value = '';
  } catch (error: any) {
    console.error('转账失败:', error);
    
    // 改进错误提示
    if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
      message.warning(t('transferToken.userCancelled') || t('createToken.userCancelled'));
    } else if (error.message?.includes('WalletNotConnectedError') || error.message?.includes('not connected')) {
      message.error(t('wallet.connectWallet'));
    } else if (error.message?.includes('insufficient funds') || error.message?.includes('余额不足')) {
      message.error(t('transferToken.insufficientBalance'));
    } else {
      message.error(`${t('transferToken.transferFailed')}: ${error.message || t('common.error')}`);
    }
  } finally {
    transferring.value = false;
  }
};

// 设置最大转账金额
const setMaxAmount = () => {
  if (senderBalance.value > 0) {
    transferAmount.value = senderBalance.value.toString();
  }
};

// 复制地址
const copyAddress = (address: string) => {
  navigator.clipboard.writeText(address)
    .then(() => {
      message.success('地址已复制到剪贴板');
    })
    .catch(() => {
      message.error('复制失败');
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
  } else {
    tokenInfo.value = null;
    senderBalance.value = 0;
    senderATA.value = '';
  }
});

// 监听钱包连接状态
watch(() => walletState.value?.connected, (isConnected) => {
  if (isConnected && tokenMintAddress.value) {
    fetchSenderBalance();
  } else {
    senderBalance.value = 0;
    senderATA.value = '';
  }
});

// 默认导出
defineOptions({
  name: 'TransferToken',
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
        <h3 class="text-2xl font-bold text-white mb-2">请先连接钱包</h3>
        <p class="text-white/60">连接钱包后即可转账代币</p>
      </div>
    </div>

    <!-- 转账表单 -->
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
              Mint 地址 <span class="text-red-400">*</span>
            </label>
            <a-input
              v-model:value="tokenMintAddress"
              placeholder="请输入代币的Mint地址"
              size="large"
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl font-mono"
              :class="{ '!border-solana-green': tokenMintAddress }"
            />
            <div class="mt-1.5 text-xs text-white/50">输入要转账的代币的Mint地址</div>
          </div>

          <!-- 代币信息显示 -->
          <div v-if="tokenInfo" class="space-y-4">
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <h3 class="m-0 text-base font-semibold text-white">代币信息</h3>
                <div class="flex items-center gap-2">
                  <a-button
                    @click="viewOnSolscan(tokenMintAddress)"
                    size="small"
                    class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-3 py-1 text-xs font-medium rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                    <template #icon>
                      <GlobalOutlined />
                    </template>
                    Solscan
                  </a-button>
                  <a-button
                    @click="fetchTokenInfo"
                    :loading="loadingInfo"
                    size="small"
                    class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-3 py-1 text-xs font-medium rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                    <template #icon>
                      <ReloadOutlined />
                    </template>
                    刷新
                  </a-button>
                </div>
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
              </div>
            </div>

            <!-- 发送者余额 -->
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-white/80">您的余额</span>
                <a-button
                  @click="fetchSenderBalance"
                  :loading="loadingBalance"
                  size="small"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-3 py-1 text-xs font-medium rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <ReloadOutlined />
                  </template>
                  刷新
                </a-button>
              </div>
              <div class="text-2xl font-bold text-solana-green mb-2">
                {{ senderBalance.toLocaleString(undefined, { maximumFractionDigits: decimals }) }}
              </div>
              <div v-if="senderATA" class="flex items-center gap-2">
                <span class="text-xs text-white/50">ATA:</span>
                <code class="text-xs text-white/70 font-mono">{{ formatAddress(senderATA) }}</code>
                <a-button
                  @click="copyAddress(senderATA)"
                  type="text"
                  size="small"
                  class="p-0 h-auto text-white/50 hover:text-white">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                </a-button>
              </div>
            </div>
          </div>

          <!-- 接收地址 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              接收地址 <span class="text-red-400">*</span>
            </label>
            <a-input
              v-model:value="recipientAddress"
              placeholder="请输入接收者的钱包地址"
              size="large"
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl font-mono"
              :class="{
                '!border-solana-green': recipientAddress && isValidSolanaAddress(recipientAddress),
                '!border-red-500': recipientAddress && !isValidSolanaAddress(recipientAddress)
              }"
            />
            <div class="mt-1.5 text-xs text-white/50">接收代币的钱包地址(Solana地址)</div>
            <div v-if="recipientAddress && !isValidSolanaAddress(recipientAddress)" class="mt-1.5 text-xs text-red-400">
              地址格式不正确
            </div>
          </div>

          <!-- 转账数量 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              转账数量 <span class="text-red-400">*</span>
            </label>
            <div class="flex items-center gap-2">
              <a-input-number
                v-model:value="transferAmount"
                :min="0"
                :max="senderBalance"
                :precision="decimals"
                :step="Math.pow(10, -decimals)"
                size="large"
                class="flex-1 bg-white/5 border-white/20 text-white rounded-xl"
                :class="{ '!border-solana-green': transferAmount }"
                placeholder="请输入转账数量"
              />
              <a-button
                @click="setMaxAmount"
                :disabled="!senderATA || senderBalance === 0"
                class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2 h-auto text-sm font-medium rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30 disabled:opacity-50 !text-white">
                MAX
              </a-button>
            </div>
            <div class="mt-1.5 text-xs text-white/50">
              最多支持 {{ decimals }} 位小数，当前余额: {{ senderBalance.toLocaleString(undefined, { maximumFractionDigits: decimals }) }}
            </div>
            <div v-if="transferAmount && parseFloat(transferAmount) > senderBalance" class="mt-1.5 text-xs text-red-400">
              转账金额不能超过当前余额
            </div>
          </div>

          <!-- 提示信息 -->
          <div
            class="flex items-start gap-3 p-4 bg-[rgba(20,241,149,0.1)] rounded-xl border border-[rgba(20,241,149,0.2)]">
            <InfoCircleOutlined class="text-solana-green text-lg shrink-0 mt-0.5" />
            <div class="flex-1">
              <div class="text-sm font-medium text-solana-green mb-1">转账提示</div>
              <div class="text-xs text-white/70">
                <ul class="m-0 pl-4 space-y-1">
                  <li>转账前请确保接收地址正确，转账到错误地址可能导致资金无法找回</li>
                  <li>如果接收者账户不存在，系统会自动创建（需要支付账户创建费用）</li>
                  <li>请确保您有足够的 SOL 支付交易手续费和账户创建费用</li>
                  <li>建议先转账小额测试</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- 转账按钮 -->
          <div class="pt-2">
            <a-button
              type="primary"
              :loading="transferring"
              :disabled="!isFormValid"
              @click="handleTransfer"
              size="large"
              block
              class="flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-3 h-auto text-[16px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
              <template #icon>
                <SendOutlined />
              </template>
              {{ transferring ? '转账中...' : '转账代币' }}
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

/* MAX 按钮文字颜色 */
:deep(.ant-btn:not(.ant-btn-primary)) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-btn:not(.ant-btn-primary):hover) {
  color: rgba(255, 255, 255, 1) !important;
}

:deep(.ant-btn:not(.ant-btn-primary):disabled) {
  color: rgba(255, 255, 255, 0.4) !important;
}
</style>
