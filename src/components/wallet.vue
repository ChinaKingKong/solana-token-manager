<script setup lang="ts">
import { ref, computed } from "vue";
import { message } from "ant-design-vue";
import { useWallet } from '../hooks/useWallet';
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
    try {
      const publicKeyStr = walletState.value.publicKey.toBase58();
      return `${publicKeyStr.slice(0, 4)}...${publicKeyStr.slice(-4)}`;
    } catch (error) {
      console.error('获取公钥字符串失败:', error);
      return "地址错误";
    }
  }

  return "连接钱包";
});

// 获取余额显示
const balanceDisplay = computed(() => {
  const balance = walletState.value.balance;
  if (typeof balance !== 'number' || isNaN(balance)) {
    return '0.0000';
  }
  return balance.toFixed(4);
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
    // Coinbase钱包总是显示（即使未安装，用户也可以看到并安装）
    if (wallet.name === 'Coinbase' || wallet.name === 'Coinbase Wallet' || wallet.name?.includes('Coinbase')) {
      return true;
    }
    // 其他钱包默认返回true
    return true;
  });
};

// 判断是否显示分割线（在每个钱包之间，除了最后一个）
const shouldShowDivider = (wallet: any, index: number) => {
  // 在每个钱包之间显示分割线，除了最后一个
  return index < availableWallets.value.length - 1;
};

const availableWallets = computed(() => {
  const wallets = detectWallets();
  return wallets;
});
</script>

<template>
  <div class="flex items-center">
    <!-- 已连接状态 -->
    <div v-if="walletState.connected" class="flex items-center">
      <a-dropdown
        v-model:open="showWalletMenu"
        trigger="click"
        placement="bottomRight"
        :overlayClassName="'wallet-menu-dropdown'"
      >
        <div class="flex items-center gap-3 px-4 bg-white/10 rounded-xl cursor-pointer transition-all duration-300 ease-in-out hover:bg-white/15" style="height: 40px;">
          <div class="w-6 h-6 flex items-center justify-center shrink-0">
            <img v-if="walletState.wallet?.icon" :src="walletState.wallet.icon" :alt="walletState.wallet?.name" class="w-full h-full object-contain" />
            <WalletOutlined v-else class="text-base text-white" />
          </div>
          <div class="text-sm font-semibold text-white font-mono">{{ getWalletDisplayText }}</div>
          <DownOutlined class="text-xs text-white/50 font-bold transition-all duration-200 ease-in-out group-hover:text-white/80" />
        </div>

        <template #overlay>
          <a-menu class="bg-white border border-black/10 rounded-lg p-1 min-w-[160px] shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
            <a-menu-item key="copy" @click="copyAddress" class="flex items-center gap-4 px-3 py-2.5 text-black/85 rounded-md transition-all duration-200 ease-in-out hover:bg-[rgba(20,241,149,0.1)] hover:text-solana-green">
              <CopyOutlined class="text-sm" />
              <span>复制地址</span>
            </a-menu-item>
            <a-menu-divider />
            <a-menu-item key="disconnect" @click="handleDisconnect" class="flex items-center gap-4 px-3 py-2.5 text-[rgba(255,77,79,0.85)] rounded-md transition-all duration-200 ease-in-out hover:bg-[rgba(255,77,79,0.1)] hover:text-[#ff4d4f]">
              <DisconnectOutlined class="text-sm" />
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
      class="bg-gradient-solana border-none text-dark-bg font-semibold px-6 h-9 text-[15px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] active:-translate-y-0.5 focus:-translate-y-0.5 focus:shadow-[0_6px_20px_rgba(20,241,149,0.4)] focus:outline-none flex items-center justify-center gap-1"
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
            v-if="shouldShowDivider(wallet, index)"
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
  </div>
</template>

<style scoped>
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

:deep(.wallet-menu-dropdown .ant-dropdown-menu-item .anticon) {
  margin-right: 16px !important;
}

:deep(.ant-dropdown-menu-item-divider) {
  background: rgba(0, 0, 0, 0.1);
  margin: 4px 0;
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

/* 钱包分割线 */
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

/* 钱包列表容器 */
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

/* 自定义模态框样式 */
:deep(.wallet-selector-modal .ant-modal-content) {
  background: rgba(26, 34, 53, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
}

:deep(.wallet-selector-modal .ant-modal-header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.02);
}

:deep(.wallet-selector-modal .ant-modal-title) {
  color: #ffffff;
  font-size: 17px;
  font-weight: 600;
}

:deep(.wallet-selector-modal .ant-modal-close-x) {
  color: rgba(255, 255, 255, 0.5);
  width: 40px;
  height: 40px;
  line-height: 40px;
}

:deep(.wallet-selector-modal .ant-modal-close-x:hover) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

:deep(.wallet-selector-modal .ant-modal-close) {
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s ease;
}

:deep(.wallet-selector-modal .ant-modal-close:hover) {
  color: #ffffff;
}

:deep(.wallet-selector-modal .ant-modal-body) {
  padding: 20px 24px;
  color: rgba(255, 255, 255, 0.85);
}
</style>
