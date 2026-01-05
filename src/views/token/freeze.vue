<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getMint,
  getAccount,
  createFreezeAccountInstruction,
  createThawAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  LockOutlined,
  UnlockOutlined,
  CopyOutlined,
  InfoCircleOutlined,
  WalletOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  GlobalOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
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
const targetAccountAddress = ref('');

// 状态
const processing = ref(false);
const loadingInfo = ref(false);
const accountInfo = ref<{
  address: string;
  mint: string;
  owner: string;
  amount: string;
  isFrozen: boolean;
} | null>(null);
const tokenInfo = ref<{
  decimals: number;
  supply: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
} | null>(null);
const isFrozen = ref(false);
const hasFreezeAuthority = ref(false);
const operationSuccess = ref(false);
const operationTransactionSignature = ref('');
const lastOperationType = ref<'freeze' | 'thaw'>('freeze');

// 操作类型
const operationType = ref<'freeze' | 'thaw'>('freeze');

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
  const hasAccountAddress = targetAccountAddress.value.trim() !== '' && isValidSolanaAddress(targetAccountAddress.value);
  const isConnected = walletState.value?.connected && walletState.value?.publicKey !== null;
  const hasAuthority = hasFreezeAuthority.value;
  
  return hasMintAddress && hasAccountAddress && isConnected && hasAuthority && accountInfo.value !== null;
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

    // 检查是否有冻结权限
    if (!mintInfo.freezeAuthority) {
      hasFreezeAuthority.value = false;
      message.warning(t('freezeManage.freezeFailed'));
    } else if (walletState.value?.publicKey) {
      const isAuthority = mintInfo.freezeAuthority.toString() === walletState.value.publicKey.toString();
      hasFreezeAuthority.value = isAuthority;
      if (!isAuthority) {
        message.warning(t('freezeManage.permissionDenied') || t('setMetadata.permissionDenied'));
      }
    } else {
      hasFreezeAuthority.value = false;
    }

    // 如果已有账户地址，自动获取账户信息
    if (targetAccountAddress.value.trim()) {
      await fetchAccountInfo();
    }
  } catch (error: any) {
    message.error(`${t('freezeManage.freezeFailed')}: ${error.message || t('freezeManage.mintAddressRequired')}`);
    tokenInfo.value = null;
    hasFreezeAuthority.value = false;
  } finally {
    loadingInfo.value = false;
  }
};

// 获取账户信息
const fetchAccountInfo = async () => {
  if (!targetAccountAddress.value.trim() || !tokenMintAddress.value.trim()) {
    return;
  }

  if (!isValidSolanaAddress(targetAccountAddress.value)) {
    message.error(t('freezeManage.addressInvalid'));
    return;
  }

  loadingInfo.value = true;
  try {
    const accountPubkey = new PublicKey(targetAccountAddress.value);
    const accountData = await getAccount(connection.value, accountPubkey);

    // 验证账户是否属于该代币
    if (accountData.mint.toString() !== tokenMintAddress.value) {
      message.error(t('freezeManage.freezeFailed'));
      accountInfo.value = null;
      return;
    }

    accountInfo.value = {
      address: accountData.address.toString(),
      mint: accountData.mint.toString(),
      owner: accountData.owner.toString(),
      amount: accountData.amount.toString(),
      isFrozen: accountData.isFrozen,
    };

    isFrozen.value = accountData.isFrozen;

    // 自动设置操作类型
    operationType.value = accountData.isFrozen ? 'thaw' : 'freeze';
  } catch (error: any) {
    if (error.message?.includes('InvalidAccountData') || error.message?.includes('AccountNotFound')) {
      message.error(t('freezeManage.freezeFailed'));
    } else {
      message.error(`${t('common.error')}: ${error.message || t('common.error')}`);
    }
    accountInfo.value = null;
    isFrozen.value = false;
  } finally {
    loadingInfo.value = false;
  }
};

// 执行冻结或解冻操作
const handleOperation = async () => {
  if (!isFormValid.value) {
    message.error(t('freezeManage.accountAddressRequired'));
    return;
  }

  if (!walletState.value?.connected || !walletState.value?.publicKey || !walletState.value?.wallet) {
    message.error(t('wallet.connectWallet'));
    return;
  }

  if (!hasFreezeAuthority.value) {
    message.error(t('freezeManage.permissionDenied') || t('setMetadata.permissionDenied'));
    return;
  }

  // 二次确认
  const actionText = operationType.value === 'freeze' ? t('freezeManage.freeze') : t('freezeManage.thaw');
  Modal.confirm({
    title: `${t('common.confirm')}${actionText}${t('freezeManage.accountAddress')}`,
    content: `${t('common.confirm')}${actionText}${t('freezeManage.accountAddress')}？`,
    okText: `${t('common.confirm')}${actionText}`,
    okType: operationType.value === 'freeze' ? 'danger' : 'primary',
    cancelText: t('common.cancel'),
    onOk: async () => {
      await executeOperation();
    }
  });
};

// 执行操作
const executeOperation = async () => {
  if (!walletState.value?.connected || !walletState.value?.publicKey) {
    message.error(t('wallet.connectWallet'));
    return;
  }

  if (!walletState.value?.wallet) {
    message.error(t('wallet.connectWallet'));
    return;
  }

  processing.value = true;

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
    const targetAccountPubkey = new PublicKey(targetAccountAddress.value);
    const ownerPubkey = walletState.value.publicKey!;
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

    // 验证冻结权限
    if (!hasFreezeAuthority.value) {
      message.error(t('freezeManage.permissionDenied') || t('setMetadata.permissionDenied'));
      return;
    }

    // 验证账户状态（确保账户存在且状态正确）
    try {
      const accountData = await getAccount(conn, targetAccountPubkey);
      
      // 验证账户是否属于该代币
      if (accountData.mint.toString() !== mintPubkey.toString()) {
        throw new Error(t('freezeManage.freezeFailed'));
      }

      // 验证当前状态是否与操作匹配
      if (operationType.value === 'freeze' && accountData.isFrozen) {
        throw new Error(t('freezeManage.alreadyFrozen'));
      }
      if (operationType.value === 'thaw' && !accountData.isFrozen) {
        throw new Error(t('freezeManage.notFrozen'));
      }
    } catch (error: any) {
      if (error.message?.includes('InvalidAccountData') || error.message?.includes('AccountNotFound')) {
        throw new Error(t('freezeManage.freezeFailed'));
      }
      throw error;
    }

    // 创建交易
    const transaction = new Transaction();

    if (operationType.value === 'freeze') {
      // 冻结账户
      transaction.add(
        createFreezeAccountInstruction(
          targetAccountPubkey, // account (代币账户)
          mintPubkey, // mint (代币mint地址)
          ownerPubkey, // freezeAuthority (冻结权限持有者)
          undefined, // multiSigners (多签账户，单签时传 undefined)
          TOKEN_PROGRAM_ID // programId (可选，默认为 TOKEN_PROGRAM_ID)
        )
      );
    } else {
      // 解冻账户
      transaction.add(
        createThawAccountInstruction(
          targetAccountPubkey, // account (代币账户)
          mintPubkey, // mint (代币mint地址)
          ownerPubkey, // freezeAuthority (冻结权限持有者)
          undefined, // multiSigners (多签账户，单签时传 undefined)
          TOKEN_PROGRAM_ID // programId (可选，默认为 TOKEN_PROGRAM_ID)
        )
      );
    }

    // 获取最近的区块哈希
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = ownerPubkey;

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
      throw new Error(`${t('freezeManage.transactionConfirmFailed')}: ${JSON.stringify(confirmation.value.err)}`);
    }

    operationTransactionSignature.value = signature;
    lastOperationType.value = operationType.value;
    operationSuccess.value = true;

    const actionText = operationType.value === 'freeze' ? t('freezeManage.freeze') : t('freezeManage.thaw');
    message.success(operationType.value === 'freeze' ? t('freezeManage.freezeSuccess') : t('freezeManage.thawSuccess'));

    // 刷新账户信息
    await fetchAccountInfo();
  } catch (error: any) {
    
    // 改进错误提示
    if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
      message.warning(t('freezeManage.userCancelled') || t('createToken.userCancelled'));
    } else if (error.message?.includes('WalletNotConnectedError') || error.message?.includes('not connected')) {
      message.error(t('wallet.connectWallet'));
    } else if (error.message?.includes('insufficient funds') || error.message?.includes('Insufficient funds')) {
      message.error(t('freezeManage.insufficientFunds'));
    } else if (error.message?.includes('InvalidAccountData') || error.message?.includes('AccountNotFound')) {
      message.error(t('freezeManage.freezeFailed'));
    } else if (error.message?.includes('already frozen') || error.message?.includes('Already frozen') || error.message?.includes(t('freezeManage.alreadyFrozen'))) {
      message.warning(t('freezeManage.alreadyFrozen'));
    } else if (error.message?.includes('not frozen') || error.message?.includes('Not frozen') || error.message?.includes('no need to thaw') || error.message?.includes(t('freezeManage.notFrozen'))) {
      message.warning(t('freezeManage.notFrozen'));
    } else if (error.name === 'WalletSendTransactionError' || error.message?.includes('Unexpected error')) {
      message.error(t('freezeManage.freezeFailed'));
    } else {
      const actionText = operationType.value === 'freeze' ? t('freezeManage.freeze') : t('freezeManage.thaw');
      const errorMsg = error.message || error.toString() || t('common.error');
      message.error(`${actionText}${t('common.error')}: ${errorMsg}`);
    }
  } finally {
    processing.value = false;
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
  operationSuccess.value = false;
  operationTransactionSignature.value = '';
  tokenMintAddress.value = '';
  targetAccountAddress.value = '';
  tokenInfo.value = null;
  accountInfo.value = null;
  isFrozen.value = false;
  hasFreezeAuthority.value = false;
};

// 监听Mint地址变化
watch(() => tokenMintAddress.value, (newValue) => {
  if (newValue && newValue.trim()) {
    fetchTokenInfo();
  } else {
    tokenInfo.value = null;
    accountInfo.value = null;
    hasFreezeAuthority.value = false;
  }
});

// 监听账户地址变化
watch(() => targetAccountAddress.value, (newValue) => {
  if (newValue && newValue.trim() && tokenMintAddress.value.trim()) {
    fetchAccountInfo();
  } else {
    accountInfo.value = null;
    isFrozen.value = false;
  }
});

// 监听钱包连接状态
watch(() => walletState.value?.connected, (isConnected) => {
  if (isConnected && tokenMintAddress.value) {
    fetchTokenInfo();
  } else {
    hasFreezeAuthority.value = false;
  }
});

// 默认导出
defineOptions({
  name: 'FreezeManage',
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
        <h3 class="text-2xl font-bold text-white mb-2">{{ t('freezeManage.connectWalletFirst') }}</h3>
        <p class="text-white/60">{{ t('freezeManage.connectWalletDesc') }}</p>
      </div>
    </div>

    <!-- 成功状态 -->
    <div v-else-if="operationSuccess" class="flex-1 flex flex-col min-h-0 py-3">
      <div
        class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border-2 border-[rgba(82,196,26,0.3)] rounded-2xl p-6 overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(82,196,26,0.5)] hover:shadow-[0_20px_40px_rgba(82,196,26,0.2)]">
        <div
          class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
        </div>
        <div class="relative z-[1]">
          <div class="flex items-center gap-3 mb-6">
            <CheckCircleOutlined class="text-3xl text-[#52c41a]" />
            <div>
              <h3 class="m-0 text-xl font-semibold text-white">{{ t('freezeManage.freezeSuccess') }}</h3>
              <p class="m-0 text-sm text-white/60 mt-1">{{ t('freezeManage.successMessage', { operation: lastOperationType === 'freeze' ? t('freezeManage.freeze') : t('freezeManage.thaw') }) }}</p>
            </div>
          </div>

          <div class="space-y-4">
            <!-- 交易签名 -->
            <div v-if="operationTransactionSignature" class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-medium text-white/80">{{ t('transactionHistory.detailSignature') }}</span>
              </div>
              <div class="flex items-center gap-2">
                <div
                  class="flex-1 px-4 py-2.5 bg-white/5 rounded-lg border border-white/10 text-sm font-mono text-white/90 break-all">
                  {{ operationTransactionSignature }}
                </div>
                <a-button @click="copyAddress(operationTransactionSignature)"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                  {{ t('common.copy') }}
                </a-button>
                <a-button @click="viewTransaction(operationTransactionSignature)"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <GlobalOutlined />
                  </template>
                  Solscan
                </a-button>
              </div>
            </div>

            <!-- 账户状态 -->
            <div v-if="accountInfo" class="grid grid-cols-2 gap-4">
              <div class="bg-white/5 rounded-xl p-4 border border-white/10">
                <div class="text-xs font-medium text-white/60 mb-1">{{ t('freezeManage.accountStatus') }}</div>
                <div class="text-base font-semibold" :class="isFrozen ? 'text-red-400' : 'text-green-400'">
                  {{ isFrozen ? t('freezeManage.frozen') : t('freezeManage.normal') }}
                </div>
              </div>
              <div class="bg-white/5 rounded-xl p-4 border border-white/10">
                <div class="text-xs font-medium text-white/60 mb-1">{{ t('freezeManage.accountBalance') }}</div>
                <div class="text-base font-semibold text-white">
                  {{ (Number(accountInfo.amount) / Math.pow(10, tokenInfo?.decimals || 9)).toLocaleString(undefined, { maximumFractionDigits: tokenInfo?.decimals || 9 }) }}
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex gap-3 pt-4">
              <a-button @click="resetForm"
                class="flex-1 flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-2.5 h-auto text-[15px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300">
                <template #icon>
                  <LockOutlined />
                </template>
                {{ t('freezeManage.continueManage') }}
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 冻结管理表单 -->
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
              {{ t('freezeManage.mintAddress') }} <span class="text-red-400">*</span>
            </label>
            <MintAddressInput
              v-model="tokenMintAddress"
              :desc="t('freezeManage.mintAddressDesc')"
            />
          </div>

      <!-- 代币信息显示 -->
          <div v-if="tokenInfo" class="space-y-4">
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <h3 class="m-0 text-base font-semibold text-white">{{ t('freezeManage.tokenInfo') }}</h3>
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
                    {{ t('freezeManage.refresh') }}
                  </a-button>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('freezeManage.decimals') }}</div>
                  <div class="text-base font-semibold text-white">{{ tokenInfo.decimals }}</div>
                </div>
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('freezeManage.currentSupply') }}</div>
                  <div class="text-sm font-semibold text-white truncate">
                    {{ (Number(tokenInfo.supply) / Math.pow(10, tokenInfo.decimals)).toLocaleString() }}
                  </div>
                </div>
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('freezeManage.freezeAuthority') }}</div>
                  <div class="text-xs font-mono text-white/90 truncate">
                    {{ tokenInfo.freezeAuthority ? formatAddress(tokenInfo.freezeAuthority) : t('mintToken.none') }}
                  </div>
                </div>
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('freezeManage.permissionStatus') }}</div>
                  <div class="text-xs font-semibold" :class="hasFreezeAuthority ? 'text-green-400' : 'text-red-400'">
                    {{ hasFreezeAuthority ? t('freezeManage.hasPermission') : t('freezeManage.noPermission') }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 权限警告 -->
            <div v-if="!hasFreezeAuthority" class="flex items-start gap-3 p-4 bg-[rgba(255,77,79,0.1)] rounded-xl border border-[rgba(255,77,79,0.2)]">
              <ExclamationCircleOutlined class="text-red-400 text-lg shrink-0 mt-0.5" />
              <div class="flex-1">
                <div class="text-sm font-medium text-red-400 mb-1">{{ t('freezeManage.noFreezePermission') }}</div>
                <div class="text-xs text-white/70">
                  {{ t('freezeManage.noFreezePermissionDesc') }}
                </div>
              </div>
            </div>
      </div>

          <!-- 目标账户地址 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('freezeManage.targetAccountAddress') }} <span class="text-red-400">*</span>
            </label>
        <a-input
          v-model:value="targetAccountAddress"
              :placeholder="t('freezeManage.targetAccountAddressPlaceholder')"
              size="large"
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl font-mono"
              :class="{
                '!border-solana-green': targetAccountAddress && isValidSolanaAddress(targetAccountAddress),
                '!border-red-500': targetAccountAddress && !isValidSolanaAddress(targetAccountAddress)
              }"
            />
            <div class="mt-1.5 text-xs text-white/50">{{ t('freezeManage.targetAccountAddressDesc') }}</div>
            <div v-if="targetAccountAddress && !isValidSolanaAddress(targetAccountAddress)" class="mt-1.5 text-xs text-red-400">
              {{ t('freezeManage.addressInvalid') }}
            </div>
          </div>

          <!-- 账户信息显示 -->
          <div v-if="accountInfo" class="space-y-4">
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <h3 class="m-0 text-base font-semibold text-white">{{ t('freezeManage.accountInfo') }}</h3>
                <a-button
                  @click="fetchAccountInfo"
                  :loading="loadingInfo"
                  size="small"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-3 py-1 text-xs font-medium rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <ReloadOutlined />
                  </template>
                  {{ t('freezeManage.refresh') }}
                </a-button>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('freezeManage.accountAddress') }}</div>
                  <div class="flex items-center gap-2">
                    <code class="text-xs text-white/70 font-mono flex-1 truncate">{{ formatAddress(accountInfo.address) }}</code>
                    <a-button
                      @click="copyAddress(accountInfo.address)"
                      type="text"
                      size="small"
                      class="p-0 h-auto text-white/50 hover:text-white">
                      <template #icon>
                        <CopyOutlined />
                      </template>
                    </a-button>
                  </div>
                </div>
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('freezeManage.accountStatus') }}</div>
                  <div class="text-sm font-semibold" :class="isFrozen ? 'text-red-400' : 'text-green-400'">
                    {{ isFrozen ? t('freezeManage.frozen') : t('freezeManage.normal') }}
                  </div>
                </div>
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('freezeManage.accountBalance') }}</div>
                  <div class="text-sm font-semibold text-white">
                    {{ (Number(accountInfo.amount) / Math.pow(10, tokenInfo?.decimals || 9)).toLocaleString(undefined, { maximumFractionDigits: tokenInfo?.decimals || 9 }) }}
                  </div>
                </div>
                <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('freezeManage.accountOwner') }}</div>
                  <div class="text-xs font-mono text-white/70 truncate">{{ formatAddress(accountInfo.owner) }}</div>
                </div>
            </div>
      </div>

      <!-- 操作类型选择 -->
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <h3 class="m-0 text-base font-semibold text-white mb-4">{{ t('freezeManage.selectOperation') }}</h3>
              <a-radio-group v-model:value="operationType" button-style="solid" class="w-full">
                <a-radio-button value="freeze" :disabled="isFrozen" class="flex-1">
            <template #icon>
              <LockOutlined />
            </template>
                  {{ t('freezeManage.freeze') }}
          </a-radio-button>
                <a-radio-button value="thaw" :disabled="!isFrozen" class="flex-1">
            <template #icon>
              <UnlockOutlined />
            </template>
                  {{ t('freezeManage.thaw') }}
          </a-radio-button>
        </a-radio-group>

              <div class="mt-4 p-3 rounded-lg" :class="operationType === 'freeze' ? 'bg-[rgba(250,173,20,0.1)] border border-[rgba(250,173,20,0.2)]' : 'bg-[rgba(82,196,26,0.1)] border border-[rgba(82,196,26,0.2)]'">
                <div v-if="operationType === 'freeze'" class="flex items-start gap-2">
                  <WarningOutlined class="text-[#faad14] text-base shrink-0 mt-0.5" />
                  <div class="flex-1">
                    <div class="text-sm font-medium text-[#faad14] mb-1">{{ t('freezeManage.freezeOperation') }}</div>
                    <div class="text-xs text-white/70">{{ t('freezeManage.freezeOperationDesc') }}</div>
                  </div>
                </div>
                <div v-else class="flex items-start gap-2">
                  <CheckCircleOutlined class="text-[#52c41a] text-base shrink-0 mt-0.5" />
                  <div class="flex-1">
                    <div class="text-sm font-medium text-[#52c41a] mb-1">{{ t('freezeManage.thawOperation') }}</div>
                    <div class="text-xs text-white/70">{{ t('freezeManage.thawOperationDesc') }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 提示信息 -->
          <div
            class="flex items-start gap-3 p-4 bg-[rgba(20,241,149,0.1)] rounded-xl border border-[rgba(20,241,149,0.2)]">
            <InfoCircleOutlined class="text-solana-green text-lg shrink-0 mt-0.5" />
            <div class="flex-1">
              <div class="text-sm font-medium text-solana-green mb-1">{{ t('freezeManage.operationTip') }}</div>
              <div class="text-xs text-white/70">
                <ul class="m-0 pl-4 space-y-1">
                  <li>{{ t('freezeManage.operationTip1') }}</li>
                  <li>{{ t('freezeManage.operationTip2') }}</li>
                  <li>{{ t('freezeManage.operationTip3') }}</li>
                  <li>{{ t('freezeManage.operationTip4') }}</li>
                </ul>
          </div>
        </div>
      </div>

          <!-- 操作按钮 -->
          <div class="pt-2">
          <a-button
            :type="operationType === 'freeze' ? 'primary' : 'default'"
            danger
            :loading="processing"
            :disabled="!isFormValid"
            @click="handleOperation"
              size="large"
              block
              :class="operationType === 'freeze' 
                ? 'flex items-center justify-center bg-gradient-to-r from-red-500 to-red-600 border-none text-white font-semibold px-6 py-3 h-auto text-[16px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(255,77,79,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0'
                : 'flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-3 h-auto text-[16px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0'">
            <template #icon>
              <LockOutlined v-if="operationType === 'freeze'" />
              <UnlockOutlined v-else />
            </template>
              {{ processing ? (operationType === 'freeze' ? t('freezeManage.freezing') : t('freezeManage.thawing')) : (operationType === 'freeze' ? t('freezeManage.freeze') : t('freezeManage.thaw')) }}
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
:deep(.ant-input) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-input:focus),
:deep(.ant-input-focused) {
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-color: #14f195 !important;
  box-shadow: 0 0 0 2px rgba(20, 241, 149, 0.2) !important;
}

:deep(.ant-input::placeholder) {
  color: rgba(255, 255, 255, 0.4) !important;
}

/* 单选按钮组样式 */
:deep(.ant-radio-group) {
  display: flex;
  gap: 8px;
}

:deep(.ant-radio-button-wrapper) {
  flex: 1;
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.ant-radio-button-wrapper:hover) {
  border-color: rgba(255, 255, 255, 0.3) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-radio-button-wrapper-checked) {
  background-color: rgba(20, 241, 149, 0.2) !important;
  border-color: #14f195 !important;
  color: #14f195 !important;
}

:deep(.ant-radio-button-wrapper:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 按钮样式覆盖 */
:deep(.ant-btn-primary:disabled) {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.4) !important;
}
</style>
