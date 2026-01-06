<script setup lang="ts">
import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { useWallet } from '../hooks/useWallet';

const { t } = useI18n();

// Props
const props = defineProps<{
  open: boolean;
}>();

// Emits
const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

// 使用钱包Hook
const walletContext = useWallet();
const { supportedWallets } = walletContext;

// 检测已安装的钱包
const detectWallets = () => {
  return supportedWallets.filter((wallet: any) => {
    // 检测Phantom钱包
    if (wallet.name === 'Phantom') {
      return (window as any).solana?.isPhantom || (window as any).solanaPhantom;
    }
    // Coinbase钱包总是显示（即使未安装，用户也可以看到并安装）
    if (wallet.name === 'Coinbase' || wallet.name === 'Coinbase Wallet' || wallet.name?.includes('Coinbase')) {
      return true;
    }
    // 其他钱包默认返回true
    return true;
  });
};

const availableWallets = computed(() => detectWallets());

// 控制模态框显示/隐藏
const modalOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

// 选择并连接钱包
const handleSelectWallet = async (walletAdapter: any) => {
  modalOpen.value = false;
  try {
    await walletContext.connectWallet(walletAdapter);
    message.success(`${t('wallet.walletConnected')} ${walletAdapter.name}`);
  } catch (error: any) {
    message.error(`${t('wallet.connectFailed')}: ${error.message || t('common.error')}`);
  }
};
</script>

<template>
  <a-modal
    v-model:open="modalOpen"
    :title="t('wallet.connectWallet')"
    :footer="null"
    width="360px"
    class="wallet-selector-modal"
  >
    <div class="wallet-list-container">
      <template v-for="(wallet, index) in availableWallets" :key="wallet.name">
        <div
          class="flex items-center justify-between px-4 py-[18px] bg-transparent cursor-pointer transition-all duration-200 ease-in-out hover:bg-white/5 active:bg-white/[0.06]"
          @click="handleSelectWallet(wallet)"
        >
          <div class="flex items-center gap-3.5 flex-1">
            <div class="w-14 h-14 flex items-center justify-center shrink-0 bg-white/5 rounded-full p-2">
              <img
                v-if="wallet.icon"
                :src="wallet.icon"
                :alt="wallet.name"
                class="w-full h-full object-contain"
              />
              <div v-else class="w-full h-full flex items-center justify-center bg-gradient-solana rounded-full text-lg font-bold text-white">
                {{ wallet.name.charAt(0) }}
              </div>
            </div>
            <div class="text-[15px] font-semibold text-white">{{ wallet.name }}</div>
          </div>
          <div class="shrink-0">
            <div class="text-[13px] font-medium text-solana-green px-3.5 py-1.5 rounded-md bg-[rgba(20,241,149,0.1)] transition-all duration-200 ease-in-out group-hover:bg-[rgba(20,241,149,0.15)] group-hover:text-solana-green">Connect</div>
          </div>
        </div>
        <div
          v-if="index < availableWallets.length - 1"
          class="wallet-divider"
        ></div>
      </template>
    </div>

    <div class="mt-6 pt-5 border-t border-white/8">
      <p class="text-center m-0">
        <small class="text-white/50 text-xs leading-relaxed">如果没有安装钱包，请先安装支持的浏览器扩展</small>
      </p>
    </div>
  </a-modal>
</template>

<style scoped>
/* 钱包选择器模态框样式 */
:deep(.wallet-selector-modal .ant-modal-content) {
  background: rgba(26, 34, 53, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
}

.wallet-list-container {
  display: flex;
  flex-direction: column;
  max-height: 500px;
  overflow-y: auto;
  gap: 0;
}

.wallet-list-container::-webkit-scrollbar {
  width: 6px;
}

.wallet-list-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.wallet-list-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.wallet-list-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.wallet-divider {
  height: 2px;
  background: linear-gradient(
    to right,
    transparent 0%,
    rgba(20, 241, 149, 0.5) 10%,
    rgba(20, 241, 149, 0.5) 50%,
    rgba(153, 69, 255, 0.5) 50%,
    rgba(153, 69, 255, 0.5) 90%,
    transparent 100%
  );
  margin: 8px 0;
  width: 100%;
  flex-shrink: 0;
  display: block;
}
</style>

