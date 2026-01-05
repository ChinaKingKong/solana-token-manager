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
const IPFSUploader = defineAsyncComponent(() => import("./views/ipfs/index.vue"));
const SetMetadata = defineAsyncComponent(() => import("./views/metadata/index.vue"));
const TransactionHistory = defineAsyncComponent(() => import("./views/history/index.vue"));
const Faucet = defineAsyncComponent(() => import("./views/faucet/index.vue"));

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
  
  // 监听导航事件
  window.addEventListener('navigate-to', ((e: CustomEvent) => {
    if (e.detail?.key) {
      handleMenuSelect(e.detail.key);
    }
  }) as EventListener);
});
</script>

<template>
  <WalletProvider>
    <div class="flex min-h-screen bg-transparent">
      <!-- 侧边栏 -->
      <Sidebar
        :active-key="activeKey"
        :collapsed="sidebarCollapsed"
        @menu-select="handleMenuSelect"
        @toggle-collapse="toggleSidebar"
      />

    <!-- 主内容区域 -->
    <div class="flex-1 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]" :class="sidebarCollapsed ? 'ml-20' : 'ml-[240px]'">
      <!-- 顶部导航栏 -->
      <Header :active-key="activeKey" :sidebar-collapsed="sidebarCollapsed" />

      <!-- 页面内容 -->
      <div class="mt-20 px-[10px] py-4 h-[calc(100vh-80px)] bg-transparent w-full max-w-full box-border overflow-y-auto md:mt-[72px] md:px-[10px] md:py-3 md:h-[calc(100vh-72px)]">
        <component :is="TokenList" v-if="activeKey === 'token-list'" />
        <component :is="TokenCreate" v-else-if="activeKey === 'create-token'" />
        <component :is="TokenMint" v-else-if="activeKey === 'mint-token'" />
        <component :is="TokenTransfer" v-else-if="activeKey === 'transfer-token'" />
        <component :is="TokenBurn" v-else-if="activeKey === 'burn-token'" />
        <component :is="TokenFreeze" v-else-if="activeKey === 'freeze-manage'" />
        <component :is="IPFSUploader" v-else-if="activeKey === 'ipfs-upload'" />
        <component :is="SetMetadata" v-else-if="activeKey === 'set-metadata'" />
        <component :is="TransactionHistory" v-else-if="activeKey === 'transaction-history'" />
        <component :is="Faucet" v-else-if="activeKey === 'faucet'" />
      </div>
    </div>
    </div>
  </WalletProvider>
</template>
