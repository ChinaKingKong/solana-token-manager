<script setup lang="ts">
import { ref, computed } from "vue";
import { message } from "ant-design-vue";
import { useWallet } from '../composables/useWallet';
import { CopyOutlined, DisconnectOutlined, WalletOutlined, DownOutlined } from '@ant-design/icons-vue';

// 使用钱包Hook
const {
  walletState,
  supportedWallets,
  connectWallet,
  disconnectWallet,
} = useWallet();

// 显示钱包选择器
const showWalletSelector = ref(false);

// 显示钱包操作菜单
const showWalletMenu = ref(false);

// 获取钱包显示文本
const getWalletDisplayText = computed(() => {
  if (!walletState.value.connected) {
    return "连接钱包";
  }

  if (walletState.value.publicKey) {
    const publicKeyStr = walletState.value.publicKey.toBase58();
    return `${publicKeyStr.slice(0, 4)}...${publicKeyStr.slice(-4)}`;
  }

  return "连接钱包";
});

// 获取余额显示
const balanceDisplay = computed(() => {
  return walletState.value.balance.toFixed(4);
});

// 连接钱包
const toggleWalletConnection = async () => {
  if (!walletState.value.connected) {
    showWalletSelector.value = true;
  }
};

// 选择并连接钱包
const handleSelectWallet = async (walletAdapter: any) => {
  showWalletSelector.value = false;

  try {
    await connectWallet(walletAdapter);
    message.success(`成功连接 ${walletAdapter.name}`);
  } catch (error: any) {
    message.error(`连接失败: ${error.message || '未知错误'}`);
    console.error(error);
  }
};

// 复制钱包地址
const copyAddress = () => {
  showWalletMenu.value = false;
  if (walletState.value.publicKey) {
    const address = walletState.value.publicKey.toBase58();
    navigator.clipboard.writeText(address)
      .then(() => {
        message.success("地址已复制到剪贴板");
      })
      .catch(() => {
        message.error("复制失败");
      });
  }
};

// 断开钱包连接
const handleDisconnect = async () => {
  showWalletMenu.value = false;
  try {
    await disconnectWallet();
    message.success("钱包已断开连接");
  } catch (error) {
    message.error("断开连接失败");
    console.error(error);
  }
};

// 检测已安装的钱包
const detectWallets = () => {
  return supportedWallets.filter((wallet: any) => {
    // 检测Phantom钱包
    if (wallet.name === 'Phantom') {
      return (window as any).solana?.isPhantom || (window as any).solanaPhantom;
    }
    // 检测Coinbase钱包
    if (wallet.name === 'Coinbase') {
      return (window as any).coinbaseSolana;
    }
    // 其他钱包默认返回true
    return true;
  });
};

const availableWallets = computed(() => {
  return detectWallets();
});
</script>

<template>
  <div class="wallet-container">
    <!-- 已连接状态 -->
    <div v-if="walletState.connected" class="wallet-connected-wrapper">
      <a-dropdown
        v-model:open="showWalletMenu"
        trigger="click"
        placement="bottomRight"
        :overlayClassName="'wallet-menu-dropdown'"
      >
        <div class="wallet-info clickable">
          <div class="wallet-icon">
            <img v-if="walletState.wallet?.icon" :src="walletState.wallet.icon" :alt="walletState.wallet?.name" />
            <span v-else class="default-icon">👛</span>
          </div>
          <div class="wallet-details">
            <div class="wallet-address">{{ getWalletDisplayText }}</div>
            <div class="wallet-balance">{{ balanceDisplay }} SOL</div>
          </div>
          <DownOutlined class="dropdown-icon" />
        </div>

        <template #overlay>
          <a-menu class="wallet-menu">
            <a-menu-item key="copy" @click="copyAddress" class="wallet-menu-item">
              <CopyOutlined class="menu-icon" />
              <span>复制地址</span>
            </a-menu-item>
            <a-menu-divider />
            <a-menu-item key="disconnect" @click="handleDisconnect" class="wallet-menu-item disconnect-item">
              <DisconnectOutlined class="menu-icon" />
              <span>断开连接</span>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>

    <!-- 未连接状态 -->
    <a-button
      v-else
      type="primary"
      size="large"
      @click="toggleWalletConnection"
      :loading="walletState.connecting"
      class="connect-btn"
    >
      <template #icon><WalletOutlined /></template>
      {{ walletState.connecting ? '连接中...' : '连接钱包' }}
    </a-button>

    <!-- 钱包选择器模态框 -->
    <a-modal
      v-model:open="showWalletSelector"
      title="选择钱包"
      :footer="null"
      width="360px"
      class="wallet-selector-modal"
    >
      <div class="wallet-list">
        <template v-for="(wallet, index) in availableWallets" :key="wallet.name">
          <div
            class="wallet-option"
            @click="handleSelectWallet(wallet)"
          >
            <div class="wallet-option-left">
              <div class="wallet-icon-wrapper">
                <img
                  v-if="wallet.icon"
                  :src="wallet.icon"
                  :alt="wallet.name"
                  class="wallet-option-icon"
                />
                <div v-else class="wallet-option-icon-placeholder">
                  {{ wallet.name.charAt(0) }}
                </div>
              </div>
              <div class="wallet-option-name">{{ wallet.name }}</div>
            </div>
            <div class="wallet-option-action">
              <div class="connect-text">Connect</div>
            </div>
          </div>
          <div
            v-if="index < availableWallets.length - 1"
            class="wallet-divider"
          ></div>
        </template>
      </div>

      <div class="wallet-footer">
        <p class="footer-text">
          <small>如果没有安装钱包，请先安装支持的浏览器扩展</small>
        </p>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.wallet-container {
  display: flex;
  align-items: center;
}

.wallet-connected-wrapper {
  display: flex;
  align-items: center;
}

.wallet-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.wallet-info:hover {
  background: rgba(255, 255, 255, 0.15);
}

.wallet-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wallet-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.default-icon {
  font-size: 20px;
}

.wallet-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wallet-address {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  font-family: monospace;
}

.wallet-balance {
  font-size: 12px;
  color: #14F195;
  font-weight: 500;
}

.dropdown-icon {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  transition: all 0.2s ease;
}

.wallet-info:hover .dropdown-icon {
  color: rgba(255, 255, 255, 0.8);
}

/* 钱包操作菜单样式 */
.wallet-menu {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 4px;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.wallet-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  color: rgba(0, 0, 0, 0.85);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.wallet-menu-item:hover {
  background: rgba(20, 241, 149, 0.1);
  color: #14F195;
}

.wallet-menu-item .menu-icon {
  font-size: 14px;
}

.wallet-menu-item.disconnect-item {
  color: rgba(255, 77, 79, 0.85);
}

.wallet-menu-item.disconnect-item:hover {
  background: rgba(255, 77, 79, 0.1);
  color: #ff4d4f;
}

:deep(.ant-dropdown-menu-item-divider) {
  background: rgba(0, 0, 0, 0.1);
  margin: 4px 0;
}

/* 下拉菜单样式覆盖 */
:deep(.wallet-menu-dropdown) {
  padding: 8px;
}

:deep(.wallet-menu-dropdown .ant-dropdown-menu) {
  background: transparent;
  box-shadow: none;
  padding: 0;
}

:deep(.wallet-menu-dropdown .ant-dropdown-menu-item) {
  background: transparent;
  padding: 0;
  margin: 0;
}

.connect-btn {
  background: linear-gradient(135deg, #14F195 0%, #9945FF 100%);
  border: none;
  color: #0B132B;
  font-weight: 600;
  padding: 0 24px;
  height: 44px;
  font-size: 15px;
}

.connect-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(20, 241, 149, 0.4);
}

.connect-btn:active,
.connect-btn:focus {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(20, 241, 149, 0.4);
  outline: none;
}

/* 移除Ant Design按钮的默认焦点样式 */
:deep(.connect-btn:focus),
:deep(.connect-btn:focus-visible),
:deep(.connect-btn:focus-within) {
  outline: none !important;
  box-shadow: 0 6px 20px rgba(20, 241, 149, 0.4) !important;
  transform: translateY(-2px);
}

:deep(.connect-btn::after) {
  display: none;
}

:deep(.connect-btn:not(:disabled):focus-visible) {
  outline: none;
  box-shadow: 0 6px 20px rgba(20, 241, 149, 0.4);
}

/* 钱包选择器样式 */
.wallet-list {
  display: flex;
  flex-direction: column;
  max-height: 500px;
  overflow-y: auto;
  gap: 0;
}

.wallet-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 16px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.wallet-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0;
}

.wallet-option:hover {
  background: rgba(255, 255, 255, 0.04);
}

.wallet-option:active {
  background: rgba(255, 255, 255, 0.06);
}

.wallet-option-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
}

.wallet-icon-wrapper {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  padding: 8px;
}

.wallet-option-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.wallet-option-icon-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(20, 241, 149, 0.2) 0%, rgba(153, 69, 255, 0.2) 100%);
  border-radius: 50%;
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
}

.wallet-option-name {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
}

.wallet-option-action {
  flex-shrink: 0;
}

.connect-text {
  font-size: 13px;
  font-weight: 500;
  color: #14F195;
  padding: 6px 14px;
  border-radius: 6px;
  background: rgba(20, 241, 149, 0.1);
  transition: all 0.2s ease;
}

.wallet-option:hover .connect-text {
  background: rgba(20, 241, 149, 0.15);
  color: #14F195;
}

.wallet-footer {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.footer-text {
  text-align: center;
  margin: 0;
}

.footer-text small {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  line-height: 1.6;
}

/* 滚动条样式 */
.wallet-list::-webkit-scrollbar {
  width: 6px;
}

.wallet-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 3px;
}

.wallet-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.wallet-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* 自定义模态框样式 */
:deep(.ant-modal-content) {
  background: rgba(26, 34, 53, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
}

:deep(.ant-modal-header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.02);
}

:deep(.ant-modal-title) {
  color: #ffffff;
  font-size: 17px;
  font-weight: 600;
}

:deep(.ant-modal-close-x) {
  color: rgba(255, 255, 255, 0.5);
  width: 40px;
  height: 40px;
  line-height: 40px;
}

:deep(.ant-modal-close-x:hover) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

:deep(.ant-modal-close) {
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s ease;
}

:deep(.ant-modal-close:hover) {
  color: #ffffff;
}

:deep(.ant-modal-body) {
  padding: 20px 24px;
  color: rgba(255, 255, 255, 0.85);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .wallet-info {
    padding: 8px 12px;
  }

  .wallet-details {
    gap: 2px;
  }
}
</style>
