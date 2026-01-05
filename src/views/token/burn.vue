<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getMint,
  getAssociatedTokenAddress,
  getAccount,
  createBurnCheckedInstruction,
} from '@solana/spl-token';
import {
  FireOutlined,
  CopyOutlined, 
  WalletOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  GlobalOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons-vue';
import { useWallet } from '../../hooks/useWallet';
import MintAddressInput from '../../components/MintAddressInput.vue';

const { t } = useI18n();

// 使用钱包Hook
const walletContext = useWallet();
const walletState = walletContext.walletState;
const connection = computed(() => walletContext.connection.value);
const network = walletContext.network;

// 代币Mint地址
const tokenMintAddress = ref('');
const burnAmount = ref('');

// 状态
const burning = ref(false);
const loadingInfo = ref(false);
const loadingBalance = ref(false);
const decimals = ref(9);
const currentBalance = ref(0);
const tokenInfo = ref<{
  decimals: number;
  supply: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
} | null>(null);
const ownerATA = ref('');
const burnSuccess = ref(false);
const burnTransactionSignature = ref('');

// 验证函数
const isFormValid = computed(() => {
  const hasMintAddress = tokenMintAddress.value.trim() !== '';
  const hasAmount = burnAmount.value && parseFloat(burnAmount.value) > 0;
  const isConnected = walletState.value?.connected && walletState.value?.publicKey !== null;
  const hasEnoughBalance = parseFloat(burnAmount.value || '0') <= currentBalance.value;
  
  return hasMintAddress && hasAmount && isConnected && hasEnoughBalance;
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
    await fetchCurrentBalance();
  } catch (error: any) {
    message.error(`${t('burnToken.fetchTokenInfoFailed')}: ${error.message || t('burnToken.checkMintAddress')}`);
    tokenInfo.value = null;
    currentBalance.value = 0;
    ownerATA.value = '';
  } finally {
    loadingInfo.value = false;
  }
};

// 获取当前余额
const fetchCurrentBalance = async () => {
  if (!tokenMintAddress.value.trim() || !walletState.value?.connected || !walletState.value?.publicKey) {
    return;
  }

  loadingBalance.value = true;
  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const ownerPubkey = walletState.value.publicKey;

    // 获取关联代币账户地址
    const ataAddress = await getAssociatedTokenAddress(
      mintPubkey,
      ownerPubkey
    );

    ownerATA.value = ataAddress.toString();

    // 获取账户余额
    try {
      const accountInfo = await getAccount(connection.value, ataAddress);
    currentBalance.value = Number(accountInfo.amount) / Math.pow(10, decimals.value);
    } catch (error: any) {
      // 账户不存在
      currentBalance.value = 0;
    }
  } catch (error: any) {
    message.error(`${t('burnToken.fetchBalanceFailed')}: ${error.message || t('burnToken.unknownError')}`);
    currentBalance.value = 0;
    ownerATA.value = '';
  } finally {
    loadingBalance.value = false;
  }
};

// 销毁代币
const handleBurn = async () => {
  if (!isFormValid.value) {
    message.error(t('burnToken.amountRequired'));
    return;
  }

  if (!walletState.value?.connected || !walletState.value?.publicKey || !walletState.value?.wallet) {
    message.error(t('wallet.connectWallet'));
    return;
  }

  // 二次确认
  Modal.confirm({
    title: t('burnToken.confirmBurn'),
    content: t('burnToken.confirmBurnMessage', { amount: burnAmount.value }),
    okText: t('burnToken.confirmBurn'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      await executeBurn();
    }
  });
};

// 执行销毁操作
const executeBurn = async () => {
  if (!walletState.value?.connected || !walletState.value?.publicKey || !walletState.value?.wallet) {
    message.error(t('wallet.connectWallet'));
    return;
  }

  burning.value = true;

  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const ownerPubkey = walletState.value.publicKey;
    const wallet = walletState.value.wallet;
    const conn = connection.value;

    // 获取关联代币账户地址
    const ataAddress = await getAssociatedTokenAddress(
      mintPubkey,
      ownerPubkey
    );

    // 检查账户是否存在
    try {
      await getAccount(conn, ataAddress);
    } catch (error: any) {
      message.error(t('burnToken.burnFailed'));
      return;
    }

    // 计算销毁数量(考虑小数位)
    const amountToBurn = Math.floor(parseFloat(burnAmount.value) * Math.pow(10, decimals.value));

    // 创建交易
    const transaction = new Transaction().add(
      createBurnCheckedInstruction(
        ataAddress, // account (代币账户)
        mintPubkey, // mint (代币mint地址)
        ownerPubkey, // owner (账户所有者)
        amountToBurn, // amount (销毁数量)
        decimals.value // decimals (小数位数)
      )
    );

    // 获取最近的区块哈希
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = ownerPubkey;

    // 验证钱包适配器是否有效
    if (!wallet || typeof wallet.sendTransaction !== 'function') {
      message.error(t('wallet.connectWallet'));
      return;
    }

    // 验证钱包适配器是否有效（连接状态已在函数开始处检查）
    if (!wallet || typeof wallet.sendTransaction !== 'function') {
      message.error(t('wallet.connectWallet'));
      return;
    }

    // 尝试发送交易
    let signature: string;
    
    try {
      // 方法1: 直接发送（标准方式）
      signature = await wallet.sendTransaction(transaction, conn);
    } catch (sendError: any) {
      // 如果直接发送失败，尝试先签名再发送
      // 检查钱包是否支持 signTransaction
      if (typeof wallet.signTransaction === 'function') {
        try {
          // 方法2: 先签名再发送
          const signedTransaction = await wallet.signTransaction(transaction);
          signature = await conn.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });
        } catch (signError: any) {
          throw sendError; // 抛出原始错误
        }
      } else {
        // 钱包不支持 signTransaction，抛出原始错误
        throw sendError;
      }
    }

    // 等待确认
    const confirmation = await conn.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`${t('burnToken.burnFailed')}: ${JSON.stringify(confirmation.value.err)}`);
    }

    burnTransactionSignature.value = signature;
    burnSuccess.value = true;
    message.success(t('burnToken.burnSuccess'));

    // 刷新余额和代币信息
    await fetchCurrentBalance();
    await fetchTokenInfo();

    // 清空表单
    burnAmount.value = '';
  } catch (error: any) {
    
    // 改进错误提示
    if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
      message.warning(t('burnToken.userCancelled') || t('createToken.userCancelled'));
    } else if (error.message?.includes('WalletNotConnectedError') || error.message?.includes('not connected') || error.message?.includes('Wallet not connected')) {
      message.error(t('wallet.connectWallet'));
    } else if (error.message?.includes('insufficient funds') || error.message?.includes('Insufficient funds')) {
      message.error(t('burnToken.insufficientBalance'));
    } else if (error.message?.includes('InvalidAccountData') || error.message?.includes('AccountNotFound')) {
      message.error(t('burnToken.burnFailed'));
    } else if (error.name === 'WalletSendTransactionError' || error.message?.includes('Unexpected error')) {
      // 处理 WalletSendTransactionError，提供更友好的错误提示
      message.error(t('burnToken.burnFailed') + ': ' + (t('common.error') || '交易发送失败，请检查网络连接或重试'));
    } else {
      const errorMsg = error.message || error.toString() || t('common.error');
      message.error(`${t('burnToken.burnFailed')}: ${errorMsg}`);
    }
  } finally {
    burning.value = false;
  }
};

// 设置最大销毁金额
const setMaxAmount = () => {
  if (currentBalance.value > 0) {
  burnAmount.value = currentBalance.value.toString();
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

// 查看交易
const viewTransaction = (signature: string) => {
  const cluster = network.value === 'mainnet' ? '' : `?cluster=${network.value}`;
  window.open(`https://solscan.io/tx/${signature}${cluster}`, '_blank');
};

// 重置表单
const resetForm = () => {
  burnSuccess.value = false;
  burnTransactionSignature.value = '';
  tokenMintAddress.value = '';
  burnAmount.value = '';
  tokenInfo.value = null;
  currentBalance.value = 0;
  ownerATA.value = '';
};

// 监听Mint地址变化
watch(() => tokenMintAddress.value, (newValue) => {
  if (newValue && newValue.trim()) {
    fetchTokenInfo();
  } else {
    tokenInfo.value = null;
    currentBalance.value = 0;
    ownerATA.value = '';
  }
});

// 监听钱包连接状态
watch(() => walletState.value?.connected, (isConnected) => {
  if (isConnected && tokenMintAddress.value) {
    fetchCurrentBalance();
  } else {
    currentBalance.value = 0;
    ownerATA.value = '';
  }
});

// 默认导出
defineOptions({
  name: 'BurnToken',
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
        <h3 class="text-2xl font-bold text-white mb-2">{{ t('burnToken.connectWalletFirst') }}</h3>
        <p class="text-white/60">{{ t('burnToken.connectWalletDesc') }}</p>
      </div>
    </div>

    <!-- 成功状态 -->
    <div v-else-if="burnSuccess" class="flex-1 flex flex-col min-h-0 py-3">
      <div
        class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border-2 border-[rgba(255,77,79,0.3)] rounded-2xl p-6 overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(255,77,79,0.5)] hover:shadow-[0_20px_40px_rgba(255,77,79,0.2)]">
        <div
          class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
        </div>
        <div class="relative z-[1]">
          <div class="flex items-center gap-3 mb-6">
            <CheckCircleOutlined class="text-3xl text-[#52c41a]" />
            <div>
              <h3 class="m-0 text-xl font-semibold text-white">{{ t('burnToken.burnSuccess') }}</h3>
              <p class="m-0 text-sm text-white/60 mt-1">{{ t('burnToken.successMessage') }}</p>
            </div>
          </div>

          <div class="space-y-4">
            <!-- 交易签名 -->
            <div v-if="burnTransactionSignature" class="bg-white/5 rounded-xl p-4 border border-white/10 relative">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-white/80">{{ t('burnToken.transactionSignature') }}</span>
                <a-button
                  type="text"
                  size="small"
                  @click="viewTransaction(burnTransactionSignature)"
                  class="flex items-center justify-center text-white px-2 py-1 h-auto transition-all duration-300 ease-in-out hover:text-solana-green flex-shrink-0">
                  <template #icon>
                    <GlobalOutlined />
                  </template>
                  {{ t('transactionHistory.viewOnSolscan') }}
                </a-button>
              </div>
              <div class="flex items-center gap-2 bg-white/5 rounded-xl p-3 border border-white/10">
                <code class="text-sm text-white/90 font-mono break-all flex-1 min-w-0">{{ burnTransactionSignature }}</code>
                <a-button
                  type="text"
                  size="small"
                  @click="copyAddress(burnTransactionSignature)"
                  class="flex items-center justify-center text-white px-2 py-1 h-auto transition-all duration-300 ease-in-out hover:text-solana-green flex-shrink-0">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                  {{ t('common.copy') }}
                </a-button>
              </div>
            </div>

            <!-- 代币信息 -->
            <div v-if="tokenInfo" class="grid grid-cols-2 gap-4">
              <div class="bg-white/5 rounded-xl p-4 border border-white/10">
                <div class="text-xs font-medium text-white/60 mb-1">{{ t('burnToken.decimals') }}</div>
                <div class="text-base font-semibold text-white">{{ tokenInfo.decimals }}</div>
              </div>
              <div class="bg-white/5 rounded-xl p-4 border border-white/10">
                <div class="text-xs font-medium text-white/60 mb-1">{{ t('burnToken.currentBalance') }}</div>
                <div class="text-base font-semibold text-white">
                  {{ currentBalance.toLocaleString(undefined, { maximumFractionDigits: decimals }) }}
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex gap-3 pt-4">
              <a-button @click="resetForm"
                class="flex-1 flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-2.5 h-auto text-[15px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300">
                <template #icon>
                  <FireOutlined />
                </template>
                {{ t('burnToken.continueBurn') }}
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 销毁表单 -->
    <div v-else class="w-full py-3">
      <div
        class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border border-white/10 rounded-2xl p-6 overflow-visible transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(255,77,79,0.3)] hover:shadow-[0_8px_32px_rgba(255,77,79,0.15)]">
        <div
          class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
        </div>
        <div class="relative z-[1] space-y-6">
          <!-- Mint 地址 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('burnToken.mintAddress') }} <span class="text-red-400">*</span>
            </label>
            <MintAddressInput
              v-model="tokenMintAddress"
              :desc="t('burnToken.mintAddressDesc')"
            />
          </div>

      <!-- 代币信息显示 -->
          <div v-if="tokenInfo" class="space-y-4">
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <h3 class="m-0 text-base font-semibold text-white">{{ t('burnToken.tokenInfo') }}</h3>
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
                    {{ t('burnToken.refresh') }}
                  </a-button>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('burnToken.decimals') }}</div>
                  <div class="text-base font-semibold text-white">{{ tokenInfo.decimals }}</div>
                </div>
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('burnToken.currentSupply') }}</div>
                  <div class="text-sm font-semibold text-white truncate">
                    {{ (Number(tokenInfo.supply) / Math.pow(10, tokenInfo.decimals)).toLocaleString() }}
                  </div>
                </div>
              </div>
      </div>

      <!-- 当前余额 -->
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-white/80">{{ t('burnToken.yourBalance') }}</span>
            <a-button
                  @click="fetchCurrentBalance"
              :loading="loadingBalance"
                  size="small"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-3 py-1 text-xs font-medium rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <ReloadOutlined />
                  </template>
                  {{ t('burnToken.refresh') }}
            </a-button>
              </div>
              <div class="text-2xl font-bold text-red-400 mb-2">
                {{ currentBalance.toLocaleString(undefined, { maximumFractionDigits: decimals }) }}
              </div>
              <div v-if="ownerATA" class="flex items-center gap-2">
                <span class="text-xs text-white/50">ATA:</span>
                <code class="text-xs text-white/70 font-mono">{{ formatAddress(ownerATA) }}</code>
                <a-button
                  @click="copyAddress(ownerATA)"
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

          <!-- 销毁数量 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('burnToken.amount') }} <span class="text-red-400">*</span>
            </label>
            <div class="flex items-center gap-2">
              <a-input-number
          v-model:value="burnAmount"
          :min="0"
          :max="currentBalance"
                :precision="decimals"
          :step="Math.pow(10, -decimals)"
                size="large"
                class="flex-1 bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl font-mono"
                :class="{ '!border-solana-green': burnAmount }"
                :placeholder="t('burnToken.amountPlaceholder')"
              />
            <a-button
              @click="setMaxAmount"
                :disabled="!ownerATA || currentBalance === 0"
                class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2 h-auto text-sm font-medium rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30 disabled:opacity-50 !text-white">
              MAX
            </a-button>
            </div>
            <div class="mt-1.5 text-xs text-white/50">
              {{ t('burnToken.maxDecimals', { decimals, balance: currentBalance.toLocaleString(undefined, { maximumFractionDigits: decimals }) }) }}
            </div>
            <div v-if="burnAmount && parseFloat(burnAmount) > currentBalance" class="mt-1.5 text-xs text-red-400">
              {{ t('burnToken.amountExceedsBalance') }}
            </div>
          </div>

          <!-- 警告信息 -->
          <div
            class="flex items-start gap-3 p-4 bg-[rgba(255,77,79,0.1)] rounded-xl border border-[rgba(255,77,79,0.2)]">
            <ExclamationCircleOutlined class="text-red-400 text-lg shrink-0 mt-0.5" />
            <div class="flex-1">
              <div class="text-sm font-medium text-red-400 mb-1">{{ t('burnToken.burnWarning') }}</div>
              <div class="text-xs text-white/70">
                <ul class="m-0 pl-4 space-y-1">
                  <li>{{ t('burnToken.burnWarning1') }}</li>
                  <li>{{ t('burnToken.burnWarning2') }}</li>
                  <li>{{ t('burnToken.burnWarning3') }}</li>
                  <li>{{ t('burnToken.burnWarning4') }}</li>
                </ul>
              </div>
            </div>
        </div>

          <!-- 销毁按钮 -->
          <div class="pt-2">
          <a-button
            type="primary"
            danger
            :loading="burning"
            :disabled="!isFormValid"
            @click="handleBurn"
              size="large"
              block
              class="flex items-center justify-center bg-gradient-to-r from-red-500 to-red-600 border-none text-white font-semibold px-6 py-3 h-auto text-[16px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(255,77,79,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
            <template #icon>
              <FireOutlined />
            </template>
              {{ burning ? t('burnToken.burning') : t('burnToken.burn') }}
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

:deep(.ant-input::placeholder),
:deep(.ant-input-number-input::placeholder) {
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

/* 危险按钮样式 */
:deep(.ant-btn-dangerous) {
  background: linear-gradient(to right, #ff4d4f, #ff7875) !important;
  border: none !important;
}

:deep(.ant-btn-dangerous:hover) {
  background: linear-gradient(to right, #ff7875, #ff9c9e) !important;
}
</style>
