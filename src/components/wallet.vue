<script setup lang="ts">
import { ref } from "vue";
import { message } from "ant-design-vue";
import {
  connectWallet,
  disconnectWallet,
  walletAddress,
  connected,
} from "../utils/wallet";

// 控制钱包连接状态
const connecting = ref(false);
// 获取钱包显示文本
const getWalletDisplayText = () => {
  if (!connected.value) {
    return "连接钱包";
  }

  if (walletAddress.value) {
    return (
      walletAddress.value.substring(0, 4) +
      "..." +
      walletAddress.value.substring(walletAddress.value.length - 4)
    );
  }

  return "DL4g..5XRB";
};

// 连接/断开钱包
const toggleWalletConnection = async () => {
  if (connected.value) {
    disconnectWallet();
    message.success("钱包已断开连接");
  } else {
    connecting.value = true;
    try {
      const success = await connectWallet();
      if (success) {
        message.success("钱包已连接");
      } else {
        message.error("钱包连接失败");
      }
    } catch (error) {
      message.error("钱包连接出错");
      console.error(error);
    } finally {
      connecting.value = false;
    }
  }
};
</script>

<template>
  <div class="wallet-container">
    <a-button
      :type="connected ? 'default' : 'primary'"
      :loading="connecting"
      @click="toggleWalletConnection"
      class="wallet-connect-btn"
    >
      <template #icon><wallet-outlined /></template>
      {{ getWalletDisplayText() }}
    </a-button>
  </div>
</template>

<style scoped>
.wallet-container {
  display: flex;
  gap: 10px;
}

.wallet-connect-btn {
  min-width: 140px;
}
</style>
