<template>
  <div class="wallet-provider">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useWalletProvider } from '../composables/useWallet';

// 初始化钱包提供者
const { walletState } = useWalletProvider();

// 组件挂载时尝试自动连接
onMounted(async () => {
  // 可选：实现自动连接逻辑
  // const context = inject(WALLET_KEY) as any;
  // if (context) {
  //   await context.autoConnect();
  // }
});
</script>

<style scoped>
.wallet-provider {
  display: contents;
}
</style>
