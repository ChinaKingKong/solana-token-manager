<script setup lang="ts">
import { ref, defineAsyncComponent, watch, onMounted } from "vue";
import Sidebar from "./components/Sidebar.vue";
import Header from "./components/Header.vue";
import WalletProvider from "./providers/WalletProvider.vue";

// 异步导入所有页面组件
const TokenList = defineAsyncComponent(() => import("./views/token/list.vue"));
const TokenCreate = defineAsyncComponent(() => import("./views/token/create.vue"));
const TokenMint = defineAsyncComponent(() => import("./views/token/mint.vue"));
const TokenTransfer = defineAsyncComponent(() => import("./views/token/transfer.vue"));
const TokenBurn = defineAsyncComponent(() => import("./views/token/burn.vue"));
const TokenFreeze = defineAsyncComponent(() => import("./views/token/freeze.vue"));
const CreateAccount = defineAsyncComponent(() => import("./views/token/create-account.vue"));
const IPFSUploader = defineAsyncComponent(() => import("./views/ipfs/index.vue"));
const SetMetadata = defineAsyncComponent(() => import("./views/metadata/index.vue"));
const TransactionHistory = defineAsyncComponent(() => import("./views/history/index.vue"));

// 当前激活的菜单项
const activeKey = ref("token-list");

// 侧边栏折叠状态
const sidebarCollapsed = ref(false);

// 处理菜单选择
const handleMenuSelect = (key: string) => {
  activeKey.value = key;
  // 在移动端选择菜单后自动滚动到顶部
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// 切换侧边栏折叠状态
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
};

// 监听侧边栏状态变化
watch(sidebarCollapsed, (collapsed) => {
  // 可以在这里添加localStorage持久化
  localStorage.setItem("sidebar-collapsed", String(collapsed));
});

// 组件挂载时从localStorage恢复侧边栏状态
onMounted(() => {
  const savedState = localStorage.getItem("sidebar-collapsed");
  if (savedState !== null) {
    sidebarCollapsed.value = savedState === "true";
  }
});
</script>

<template>
  <WalletProvider>
    <div class="app-container" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <!-- 侧边栏 -->
      <Sidebar
        :active-key="activeKey"
        :collapsed="sidebarCollapsed"
        @menu-select="handleMenuSelect"
        @toggle-collapse="toggleSidebar"
      />

    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 顶部导航栏 -->
      <Header :active-key="activeKey" :sidebar-collapsed="sidebarCollapsed" />

      <!-- 页面内容 -->
      <div class="page-content">
        <component :is="TokenList" v-if="activeKey === 'token-list'" />
        <component :is="TokenCreate" v-else-if="activeKey === 'create-token'" />
        <component :is="TokenMint" v-else-if="activeKey === 'mint-token'" />
        <component :is="TokenTransfer" v-else-if="activeKey === 'transfer-token'" />
        <component :is="TokenBurn" v-else-if="activeKey === 'burn-token'" />
        <component :is="TokenFreeze" v-else-if="activeKey === 'freeze-manage'" />
        <component :is="CreateAccount" v-else-if="activeKey === 'create-associated'" />
        <component :is="IPFSUploader" v-else-if="activeKey === 'ipfs-upload'" />
        <component :is="SetMetadata" v-else-if="activeKey === 'set-metadata'" />
        <component :is="TransactionHistory" v-else-if="activeKey === 'transaction-history'" />
      </div>
    </div>
    </div>
  </WalletProvider>
</template>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
    'Noto Color Emoji';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  height: 100%;
}

/* 全局深色主题 */
body {
  background: linear-gradient(135deg, #0B132B 0%, #1A2235 50%, #0B132B 100%);
  color: #ffffff;
  overflow-x: hidden;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

::-webkit-scrollbar-thumb {
  background: rgba(20, 241, 149, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(20, 241, 149, 0.5);
}

/* Ant Design 样式覆盖 - 深色主题 */
:deep(.ant-card) {
  background: rgba(26, 34, 53, 0.6) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.ant-card-head) {
  border-bottom-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.ant-card-head-title) {
  color: #ffffff !important;
}

:deep(.ant-card-body) {
  color: rgba(255, 255, 255, 0.85) !important;
}

/* 按钮样式 */
:deep(.ant-btn-primary) {
  background: linear-gradient(135deg, #14F195 0%, #9945FF 100%) !important;
  border-color: #14F195 !important;
  color: #0B132B !important;
  font-weight: 500;
}

:deep(.ant-btn-primary:hover) {
  opacity: 0.9;
  box-shadow: 0 4px 12px rgba(20, 241, 149, 0.4);
}

:deep(.ant-btn-default) {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: #ffffff !important;
}

:deep(.ant-btn-default:hover) {
  background: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
}

:deep(.ant-btn-link) {
  color: #14F195 !important;
}

:deep(.ant-btn-link:hover) {
  color: #9945FF !important;
}

/* 输入框样式 */
:deep(.ant-input),
:deep(.ant-input-number),
:deep(.ant-select-selector) {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
}

:deep(.ant-input::placeholder),
:deep(.ant-input-number-input::placeholder) {
  color: rgba(255, 255, 255, 0.4) !important;
}

:deep(.ant-input:hover),
:deep(.ant-input-number:hover),
:deep(.ant-select-selector:hover) {
  border-color: rgba(20, 241, 149, 0.3) !important;
}

:deep(.ant-input:focus),
:deep(.ant-input-number:focus),
:deep(.ant-select-focused .ant-select-selector) {
  border-color: #14F195 !important;
  box-shadow: 0 0 0 2px rgba(20, 241, 149, 0.1) !important;
}

/* 下拉菜单样式 */
:deep(.ant-select-dropdown) {
  background: rgba(26, 34, 53, 0.95) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(10px);
}

:deep(.ant-select-item) {
  color: rgba(255, 255, 255, 0.85) !important;
}

:deep(.ant-select-item-option-selected) {
  background: rgba(20, 241, 149, 0.2) !important;
  color: #14F195 !important;
}

:deep(.ant-select-item-option-active) {
  background: rgba(20, 241, 149, 0.1) !important;
}

/* 模态框样式 */
:deep(.ant-modal-content) {
  background: rgba(26, 34, 53, 0.95) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.ant-modal-header) {
  border-bottom-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.ant-modal-title) {
  color: #ffffff !important;
}

:deep(.ant-modal-close-x) {
  color: rgba(255, 255, 255, 0.6) !important;
}

:deep(.ant-modal-close-x:hover) {
  color: #ffffff !important;
}

:deep(.ant-modal-body) {
  color: rgba(255, 255, 255, 0.85) !important;
}

/* 消息提示样式 */
:deep(.ant-message) {
  top: 100px !important;
}

:deep(.ant-message-notice-content) {
  background: rgba(26, 34, 53, 0.95) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff !important;
}

/* 表格样式 */
:deep(.ant-table) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.85) !important;
}

:deep(.ant-table-thead > tr > th) {
  background: rgba(26, 34, 53, 0.8) !important;
  border-bottom-color: rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
}

:deep(.ant-table-tbody > tr > td) {
  border-bottom-color: rgba(255, 255, 255, 0.05) !important;
}

:deep(.ant-table-tbody > tr:hover > td) {
  background: rgba(20, 241, 149, 0.05) !important;
}

/* 标签样式 */
:deep(.ant-tag) {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.85) !important;
}

/* 描述列表样式 */
:deep(.ant-descriptions-item-label) {
  background: rgba(255, 255, 255, 0.05) !important;
  color: rgba(255, 255, 255, 0.6) !important;
}

:deep(.ant-descriptions-item-content) {
  color: rgba(255, 255, 255, 0.85) !important;
}

/* 分割线样式 */
:deep(.ant-divider) {
  border-top-color: rgba(255, 255, 255, 0.1) !important;
}

/* 应用容器 */
.app-container {
  display: flex;
  min-height: 100vh;
  background: transparent;
}

.main-content {
  flex: 1;
  margin-left: 240px;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.app-container.sidebar-collapsed .main-content {
  margin-left: 80px;
}

/* 页面内容区域 */
.page-content {
  margin-top: 80px;
  padding: 32px;
  min-height: calc(100vh - 80px);
  background: transparent;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
  }

  .page-content {
    margin-top: 72px;
    padding: 16px;
  }
}
</style>
