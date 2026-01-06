<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { useWallet } from '../../hooks/useWallet';
import WalletSelectorModal from '../../components/WalletSelectorModal.vue';
import { ReloadOutlined, CheckCircleOutlined, CopyOutlined, GiftOutlined } from '@ant-design/icons-vue';
import { Connection } from '@solana/web3.js';

const { t } = useI18n();

// 使用钱包Hook
const walletContext = useWallet();
const walletState = walletContext.walletState;
const network = walletContext.network;
const fetchBalance = walletContext.fetchBalance;

// 状态
const requesting = ref(false);
const lastRequestTime = ref<Date | null>(null);
const requestCount = ref(0);


// 检查是否可以请求（移除钱包连接检查，允许未连接时查看页面）
const canRequest = computed(() => {
  // 检查网络是否为测试网
  if (network.value !== 'devnet') {
    return false;
  }
  
  // 检查是否在冷却期内（8小时内只能请求一次）
  if (lastRequestTime.value) {
    const hoursSinceLastRequest = (Date.now() - lastRequestTime.value.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastRequest < 8) {
      return false;
    }
  }
  
  return true;
});

// 钱包选择器
const showWalletSelector = ref(false);

// 获取冷却时间剩余
const cooldownRemaining = computed(() => {
  if (!lastRequestTime.value) return null;
  
  const hoursSinceLastRequest = (Date.now() - lastRequestTime.value.getTime()) / (1000 * 60 * 60);
  const hoursRemaining = 8 - hoursSinceLastRequest;
  
  if (hoursRemaining <= 0) return null;
  
  const hours = Math.floor(hoursRemaining);
  const minutes = Math.floor((hoursRemaining - hours) * 60);
  
  return { hours, minutes };
});

// 请求测试SOL
const requestTestSol = async () => {
  // 首先检查网络是否为测试网
  if (network.value !== 'devnet') {
    message.error(t('faucet.devnetOnly'));
    return;
  }

  // 检查钱包连接，如果未连接则弹出连接钱包弹框
  if (!walletState.value?.connected || !walletState.value?.publicKey) {
    showWalletSelector.value = true;
    return;
  }

  if (!canRequest.value) {
    if (cooldownRemaining.value) {
      message.warning(t('faucet.cooldownMessage', cooldownRemaining.value));
      return;
    }
    return;
  }

  requesting.value = true;

  try {
    const publicKey = walletState.value.publicKey!;

    // 确保使用测试网RPC端点
    if (network.value !== 'devnet') {
      throw new Error('仅限测试网使用');
    }

    // 强制使用 Solana 官方的 devnet RPC 端点来请求空投
    // 因为某些第三方 RPC 服务（如 Alchemy）可能不支持 requestAirdrop 方法
    const faucetConnection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // 请求空投
    const totalAmount = 2000000000; // 2 SOL (in lamports)
    
    // 使用 Solana Web3.js 的 requestAirdrop 方法
    const signature = await faucetConnection.requestAirdrop(publicKey, totalAmount);

    if (!signature) {
      throw new Error('请求失败：未收到交易签名');
    }

    // 获取最新的 blockhash 和 lastValidBlockHeight 用于最终确认
    const { blockhash, lastValidBlockHeight } = await faucetConnection.getLatestBlockhash('confirmed');

    // 等待最后一笔交易确认，使用更可靠的确认方式
    const confirmation = await faucetConnection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      'confirmed'
    );

    // 检查交易是否成功
    if (confirmation.value.err) {
      throw new Error(`交易失败: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    // 更新状态
    lastRequestTime.value = new Date();
    requestCount.value += 1;
    
    // 保存到localStorage（基于当前钱包地址）
    saveHistory();
    
    // 等待一下再刷新余额，确保余额已更新
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 刷新余额（使用原始连接）
    await fetchBalance();
    
    message.success(t('faucet.requestSuccess'));
  } catch (error: any) {
    // 处理特定错误
    let errorMessage = t('faucet.requestFailed');
    
    if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.toString) {
      errorMessage = error.toString();
    }
    
    // 检查是否是速率限制错误
    if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
      errorMessage = t('faucet.requestFailed') + ': 请求过于频繁，请稍后再试';
    } else if (errorMessage.includes('Internal error') || errorMessage.includes('Internal Error') || errorMessage.includes('internal')) {
      // 内部错误，可能是网络拥堵或单次请求金额过大
      errorMessage = t('faucet.requestFailed') + ': 网络内部错误，可能是网络拥堵或请求金额过大，请稍后重试';
    } else if (errorMessage.includes('Invalid request') || errorMessage.includes('invalid') || errorMessage.includes('请求格式错误')) {
      // 可能是RPC端点问题，提供更详细的错误信息
      errorMessage = t('faucet.requestFailed') + ': RPC端点可能不支持空投请求，请检查网络配置或稍后重试';
    } else if (errorMessage.includes('network') || errorMessage.includes('Network') || errorMessage.includes('连接')) {
      errorMessage = t('faucet.requestFailed') + ': 网络连接问题，请检查网络设置';
    }
    
    message.error(errorMessage);
  } finally {
    requesting.value = false;
  }
};

// 复制地址
const copyAddress = (text: string) => {
  navigator.clipboard.writeText(text)
    .then(() => {
      message.success(t('wallet.addressCopied'));
    })
    .catch(() => {
      message.error(t('common.error'));
    });
};

// 格式化地址
const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 8)}.....${address.slice(-8)}`;
};

// 获取当前钱包地址的localStorage键
const getStorageKey = (key: string) => {
  const publicKey = walletState.value?.publicKey?.toBase58();
  if (!publicKey) return null;
  return `faucet-${key}-${publicKey}`;
};

// 从localStorage加载历史记录（基于当前钱包地址）
const loadHistory = () => {
  const lastRequestKey = getStorageKey('last-request');
  const countKey = getStorageKey('request-count');
  
  if (lastRequestKey) {
    const lastRequest = localStorage.getItem(lastRequestKey);
    if (lastRequest) {
      lastRequestTime.value = new Date(lastRequest);
    } else {
      lastRequestTime.value = null;
    }
  } else {
    lastRequestTime.value = null;
  }
  
  if (countKey) {
    const count = localStorage.getItem(countKey);
    if (count) {
      requestCount.value = parseInt(count, 10);
    } else {
      requestCount.value = 0;
    }
  } else {
    requestCount.value = 0;
  }
};

// 保存历史记录到localStorage（基于当前钱包地址）
const saveHistory = () => {
  const lastRequestKey = getStorageKey('last-request');
  const countKey = getStorageKey('request-count');
  
  if (lastRequestKey && lastRequestTime.value) {
    localStorage.setItem(lastRequestKey, lastRequestTime.value.toISOString());
  }
  
  if (countKey) {
    localStorage.setItem(countKey, String(requestCount.value));
  }
};

// 清除历史记录（切换钱包时调用）
const clearHistory = () => {
  lastRequestTime.value = null;
  requestCount.value = 0;
};

// 组件挂载时加载历史记录
loadHistory();

// 监听钱包地址变化（切换钱包时重置记录）
watch(() => walletState.value?.publicKey?.toBase58(), (newPublicKey, oldPublicKey) => {
  if (newPublicKey && oldPublicKey && newPublicKey !== oldPublicKey) {
    // 钱包切换：清除旧记录，加载新钱包的记录
    clearHistory();
    loadHistory();
  } else if (newPublicKey && !oldPublicKey) {
    // 新连接：加载记录
    loadHistory();
  } else if (!newPublicKey && oldPublicKey) {
    // 断开连接：清除记录
    clearHistory();
  }
});

// 监听网络变化
watch(() => network.value, () => {
  if (network.value !== 'devnet') {
    message.warning(t('faucet.devnetOnly'));
  }
});

// 默认导出
defineOptions({
  name: 'Faucet',
});
</script>

<template>
  <div class="p-0 w-full max-w-full animate-[fadeIn_0.3s_ease-in] min-h-full flex flex-col">
    <!-- 非测试网提示 -->
    <div v-if="network !== 'devnet'" class="flex items-center justify-center min-h-[400px] flex-1">
      <div class="text-center">
        <div class="mb-6 animate-bounce">
          <GiftOutlined class="text-6xl text-white/30" />
        </div>
        <h3 class="text-2xl font-bold text-white mb-2">{{ t('faucet.devnetOnly') }}</h3>
        <p class="text-white/60">{{ t('faucet.switchToDevnet') }}</p>
      </div>
    </div>

    <!-- 主内容 -->
    <div v-else class="flex-1 flex flex-col min-h-0 py-3">
      <div
        class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border border-white/10 rounded-2xl p-6 overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(20,241,149,0.3)] hover:shadow-[0_20px_40px_rgba(20,241,149,0.15)]">
        <div class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
        <div class="relative z-[1]">
          <!-- 标题 -->
          <div class="flex items-center gap-3 mb-6">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-solana">
              <GiftOutlined class="text-2xl text-dark-bg" />
            </div>
            <div>
              <h2 class="m-0 text-2xl font-semibold text-white">{{ t('faucet.title') }}</h2>
              <p class="m-0 text-sm text-white/60 mt-1">{{ t('faucet.description') }}</p>
            </div>
          </div>

          <!-- 钱包信息 -->
          <div class="bg-white/5 rounded-xl p-4 border border-white/10 mb-6">
            <div class="text-xs font-medium text-white/60 mb-2">{{ t('faucet.walletAddress') }}</div>
            <div class="flex items-center gap-2 px-4 py-2.5 bg-white/5 rounded-lg border border-white/10">
              <div class="flex-1 text-sm font-mono text-white/90 break-all min-w-0">
                {{ walletState.publicKey ? formatAddress(walletState.publicKey.toBase58()) : '' }}
              </div>
              <a-button
                @click="copyAddress(walletState.publicKey?.toBase58() || '')"
                type="text"
                size="small"
                class="flex items-center justify-center text-white px-2 py-1 h-auto transition-all duration-300 ease-in-out hover:text-solana-green flex-shrink-0">
                <template #icon>
                  <CopyOutlined />
                </template>
              </a-button>
            </div>
          </div>

          <!-- 余额信息 -->
          <div class="bg-white/5 rounded-xl p-4 border border-white/10 mb-6">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs font-medium text-white/60 mb-1">{{ t('faucet.currentBalance') }}</div>
                <div class="text-2xl font-bold text-solana-green">{{ walletState.balance?.toFixed(4) || '0.0000' }} SOL</div>
              </div>
              <a-button
                @click="fetchBalance"
                type="text"
                size="small"
                class="flex items-center justify-center text-white px-3 py-1 h-auto transition-all duration-300 ease-in-out hover:text-solana-green">
                <template #icon>
                  <ReloadOutlined />
                </template>
                {{ t('faucet.refresh') }}
              </a-button>
            </div>
          </div>

          <!-- 请求信息 -->
          <div v-if="lastRequestTime || requestCount > 0" class="bg-white/5 rounded-xl p-4 border border-white/10 mb-6">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-xs font-medium text-white/60 mb-1">{{ t('faucet.lastRequest') }}</div>
                <div class="text-sm text-white/90">
                  {{ lastRequestTime ? new Date(lastRequestTime).toLocaleString() : t('faucet.never') }}
                </div>
              </div>
              <div>
                <div class="text-xs font-medium text-white/60 mb-1">{{ t('faucet.requestCount') }}</div>
                <div class="text-sm text-white/90">{{ requestCount }}</div>
              </div>
            </div>
            <div v-if="cooldownRemaining" class="mt-4 pt-4 border-t border-white/10">
              <div class="text-xs font-medium text-white/60 mb-1">{{ t('faucet.cooldownRemaining') }}</div>
              <div class="text-sm text-solana-green">
                {{ cooldownRemaining.hours }} {{ t('faucet.hours') }} {{ cooldownRemaining.minutes }} {{ t('faucet.minutes') }}
              </div>
            </div>
          </div>

          <!-- 请求按钮 -->
          <div class="flex flex-col gap-4">
            <a-button
              @click="requestTestSol"
              :loading="requesting"
              :disabled="!canRequest"
              :class="['w-full flex items-center justify-center border-none font-semibold px-6 py-3 h-auto text-base hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300', requesting ? 'bg-white/10 text-white' : 'bg-gradient-solana text-dark-bg']">
              <template #icon>
                <ReloadOutlined v-if="!requesting" />
              </template>
              {{ requesting ? t('faucet.requesting') : t('faucet.requestButton') }}
            </a-button>

            <div v-if="!canRequest && walletState.connected && network === 'devnet'" class="text-center">
              <p class="text-sm text-white/60">{{ t('faucet.cooldownMessage', cooldownRemaining || { hours: 0, minutes: 0 }) }}</p>
            </div>
          </div>

          <!-- 提示信息 -->
          <div class="mt-6 bg-solana-green/10 rounded-xl p-4 border border-solana-green/20">
            <div class="flex items-start gap-3">
              <CheckCircleOutlined class="text-lg text-solana-green flex-shrink-0 mt-0.5" />
              <div class="flex-1">
                <div class="text-sm font-medium text-white mb-2">{{ t('faucet.tips') }}</div>
                <ul class="text-xs text-white/70 space-y-1 list-disc list-inside">
                  <li>{{ t('faucet.tip1') }}</li>
                  <li>{{ t('faucet.tip2') }}</li>
                  <li>{{ t('faucet.tip3') }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 钱包选择器模态框 -->
    <WalletSelectorModal v-model:open="showWalletSelector" />
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

</style>

