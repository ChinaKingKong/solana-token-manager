<template>
  <div class="wallet-provider">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { onMounted, inject } from 'vue';
import { useWalletProvider, WALLET_KEY } from '../hooks/useWallet';

// 初始化钱包提供者
const { walletState } = useWalletProvider();

// 组件挂载时尝试自动连接
onMounted(async () => {
  // 等待一小段时间，确保钱包适配器和 window 对象已初始化，以及 provide 已完成
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 获取钱包上下文并尝试自动连接
  const walletContext = inject(WALLET_KEY) as any;
  if (walletContext) {
    try {
      // 首先尝试检查是否已经连接
      if (walletContext.checkWalletConnection) {
        const alreadyConnected = await walletContext.checkWalletConnection();
        if (alreadyConnected) {
          return; // 已经连接，不需要继续
        }
      }
      
      // 如果还没有连接，尝试自动连接
      if (walletContext.autoConnect) {
        const connected = await walletContext.autoConnect();
        // 如果自动连接成功，connected 应该为 true
      }
    } catch (error) {
      // 自动连接失败，静默处理（不显示错误）
      // 这通常是因为钱包需要用户授权才能连接
    }
  }
});
</script>

<style scoped>
.wallet-provider {
  display: contents;
}
</style>
