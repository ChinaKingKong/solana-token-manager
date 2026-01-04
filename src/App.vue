<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent, h } from "vue";
import {
  WalletOutlined,
  HomeOutlined,
  UploadOutlined,
  FileTextOutlined,
  PlusOutlined,
  FireOutlined,
  LockOutlined,
  MenuOutlined,
} from "@ant-design/icons-vue";
import { message } from "ant-design-vue";


// 异步导入组件
const TokenList = defineAsyncComponent(() => import("./views/token/list.vue"));
const TokenCreate = defineAsyncComponent(
  () => import("./views/token/create.vue")
);
const IPFSUploader = defineAsyncComponent(
  () => import("./views/ipfs/index.vue")
);
const SetMetadata = defineAsyncComponent(
  () => import("./views/metadata/index.vue")
);

// 活动菜单项
const activeKey = ref("token-list"); 

// 移动菜单显示状态
const mobileMenuVisible = ref(false);
const toggleMobileMenu = () => {
  mobileMenuVisible.value = !mobileMenuVisible.value;
};

// 窗口宽度
const windowWidth = ref(window.innerWidth);
const isMobile = ref(windowWidth.value < 768);

// 监听窗口大小变化
onMounted(() => {
  window.addEventListener("resize", () => {
    windowWidth.value = window.innerWidth;
    isMobile.value = windowWidth.value < 768;
    if (!isMobile.value) {
      mobileMenuVisible.value = false;
    }
  });
}); 

// 菜单项定义
const menuItems = [
  {
    key: "token-list",
    icon: () => h(HomeOutlined),
    label: "代币列表",
  },
  {
    key: "create-token",
    icon: () => h(PlusOutlined),
    label: "创建代币",
  },
  {
    key: "create-associated",
    icon: () => h(FileTextOutlined),
    label: "创建关联账户",
  },
  {
    key: "ipfs-upload",
    icon: () => h(UploadOutlined),
    label: "IPFS上传",
  },
  {
    key: "set-metadata",
    icon: () => h(FileTextOutlined),
    label: "设置Metadata",
  },
  {
    key: "mint-token",
    icon: () => h(PlusOutlined),
    label: "铸造代币",
  },
  {
    key: "burn-token",
    icon: () => h(FireOutlined),
    label: "销毁代币",
  },
  {
    key: "freeze-manage",
    icon: () => h(LockOutlined),
    label: "冻结管理",
  },
];

// 菜单选择处理
const handleMenuSelect = (key: string) => {
  activeKey.value = key;
  // 在移动端选择菜单项后自动关闭菜单
  if (isMobile.value) {
    mobileMenuVisible.value = false;
  }
}; 
</script>

<template>
  <a-layout class="app-layout">
    <!-- 头部 -->
    <a-layout-header class="app-header">
      <div class="header-content">
        <div class="header-left">
          <div class="logo">
            <img src="/favicon.png" alt="Logo" class="logo-image" />
          </div>
          <button
            class="mobile-menu-btn"
            @click="toggleMobileMenu"
            v-if="isMobile"
          >
            <menu-outlined />
          </button>
        </div>

        <div
          class="header-center"
          :class="{ 'mobile-hidden': isMobile && !mobileMenuVisible }"
        >
          <a-menu
            mode="horizontal"
            :selectedKeys="[activeKey]"
            @select="handleMenuSelect($event.key)"
            class="desktop-menu"
            :style="{ backgroundColor: '#001529 !important' }"
          >
            <a-menu-item
              v-for="item in menuItems"
              :key="item.key"
              :style="{ color: '#ffffff !important', fontSize: '14px' }"
            >
              <template #icon>
                <component
                  :is="item.icon"
                  :style="{ color: '#ffffff !important', fontSize: '14px' }"
                />
              </template>
              <span
                :style="{ color: '#ffffff !important', marginLeft: '4px' }"
                >{{ item.label }}</span
              >
            </a-menu-item>
          </a-menu>
        </div> 
      </div>

      <!-- 移动端菜单下拉 -->
      <div
        v-if="isMobile"
        class="mobile-menu"
        :class="{ 'mobile-menu-visible': mobileMenuVisible }"
      >
        <a-menu
          mode="inline"
          :selectedKeys="[activeKey]"
          @select="handleMenuSelect($event.key)"
          :style="{ backgroundColor: '#001529 !important' }"
        >
          <a-menu-item
            v-for="item in menuItems"
            :key="item.key"
            :style="{ color: '#ffffff !important', fontSize: '14px' }"
          >
            <template #icon>
              <component
                :is="item.icon"
                :style="{ color: '#ffffff !important', fontSize: '14px' }"
              />
            </template>
            <span :style="{ color: '#ffffff !important', marginLeft: '4px' }">{{
              item.label
            }}</span>
          </a-menu-item>
        </a-menu>
      </div>
    </a-layout-header>

    <!-- 内容区域 -->
    <a-layout-content class="app-content">
      <div class="content-container">
        <template v-if="activeKey === 'token-list'">
          <TokenList />
        </template>

        <template v-else-if="activeKey === 'create-token'">
          <TokenCreate />
        </template>

        <template v-else-if="activeKey === 'ipfs-upload'">
          <IPFSUploader />
        </template>

        <template v-else-if="activeKey === 'set-metadata'">
          <SetMetadata />
        </template>

        <template v-else-if="activeKey === 'create-associated'">
          <div class="placeholder-content">创建关联账户功能尚未实现</div>
        </template>

        <template v-else-if="activeKey === 'mint-token'">
          <div class="placeholder-content">铸造代币功能尚未实现</div>
        </template>

        <template v-else-if="activeKey === 'burn-token'">
          <div class="placeholder-content">销毁代币功能尚未实现</div>
        </template>

        <template v-else-if="activeKey === 'freeze-manage'">
          <div class="placeholder-content">冻结管理功能尚未实现</div>
        </template>
      </div>
    </a-layout-content>

    <!-- 底部 -->
    <a-layout-footer class="app-footer">
      Solana Token Manager ©2025 Created by WSPN
    </a-layout-footer>
  </a-layout>
</template>

<style>
/* 全局样式 */
body {
  margin: 0;
  padding: 0;
}

/* 创建一个全局 CSS 变量 */
:root {
  --menu-bg-color: #001529;
}

/* 布局样式 */
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background-color: var(--menu-bg-color);
  padding: 0;
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
  padding: 0 2px;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  background: var(--menu-bg-color) !important;
}

.header-right {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  color: white;
  margin-right: 24px;
}

.logo-image {
  width: 44px;
  height: 44px;
  margin-right: 10px;
} 

.mobile-menu-btn {
  display: none;
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  margin-left: auto;
}

.mobile-menu {
  display: none;
  background-color: var(--menu-bg-color);
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.mobile-menu-visible {
  max-height: 500px;
  background: var(--menu-bg-color) !important;
}

.app-content {
  flex: 1;
  padding: 24px;
  background-color: #f0f2f5;
  overflow: auto;
}

.content-container {
  max-width: 1200px;
  margin: 0 auto;
  background-color: #fff;
  padding: 24px;
  border-radius: 4px; 
}

.placeholder-content {
  text-align: center;
  padding: 48px 0;
  color: #bfbfbf;
  font-size: 16px;
}

.app-footer {
  text-align: center;
  background-color: var(--menu-bg-color);
  color: rgba(255, 255, 255, 0.65);
  padding: 16px 50px;
}
 
/* 媒体查询 - 移动端适配 */
@media (max-width: 767px) {
  .header-content {
    flex-wrap: wrap;
  }

  .header-left {
    width: 100%;
    justify-content: space-between;
  }

  .mobile-menu-btn {
    display: block;
  }

  .mobile-menu {
    display: block;
    width: 100%;
  }

  .mobile-hidden {
    display: none;
  }

  .header-center,
  .header-right {
    width: 100%;
  }

  .desktop-menu {
    display: none;
  }

  .app-content {
    padding: 16px;
  }

  .content-container {
    padding: 16px;
  }

  .app-footer {
    padding: 12px 16px;
  }
}

/* 添加全局强制样式覆盖 */
:deep(.ant-menu),
:deep(.ant-menu-sub),
:deep(.ant-menu-inline),
:deep(.ant-menu-horizontal),
:deep(.ant-menu-vertical),
:deep(.ant-menu-item),
:deep(.ant-menu-submenu),
:deep(.ant-menu-submenu-popup) {
  background-color: var(--menu-bg-color) !important;
}

:deep(.ant-menu-item),
:deep(.ant-menu-submenu-title) {
  background-color: var(--menu-bg-color) !important;
}

:deep(.ant-menu-submenu-popup > .ant-menu) {
  background-color: var(--menu-bg-color) !important;
}

:deep(.ant-menu-light) {
  background-color: var(--menu-bg-color) !important;
}

/* 还需要添加内联样式 */
.mobile-menu .ant-menu {
  background-color: var(--menu-bg-color) !important;
}

/* 同时修改头部相关元素 */
.header-content,
.app-header,
.mobile-menu-visible {
  background: var(--menu-bg-color) !important;
}

/* 强制覆盖的样式 */
:deep(.ant-menu-item),
:deep(.ant-menu-item-only-child),
:deep(.ant-menu-item a),
:deep(.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item),
:deep(.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-submenu),
:deep(.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item a),
:deep(
    .ant-menu-horizontal:not(.ant-menu-dark)
      > .ant-menu-submenu
      .ant-menu-submenu-title
  ) {
  color: #ffffff !important;
  font-size: 14px !important;
}

:deep(.ant-menu-item .anticon),
:deep(.ant-menu-submenu-title .anticon),
:deep(.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item .anticon),
:deep(.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-submenu .anticon) {
  color: #ffffff !important;
  font-size: 14px !important;
  margin-right: 4px !important;
}

/* 覆盖span元素 */
:deep(.ant-menu-item span),
:deep(.ant-menu-submenu-title span),
:deep(.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item span),
:deep(.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-submenu span) {
  color: #ffffff !important;
  font-size: 14px !important;
}

/* 针对选中状态的特别处理 */
:deep(.ant-menu-item-selected),
:deep(.ant-menu-item-selected a),
:deep(.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item-selected),
:deep(.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item-selected a) {
  color: #1890ff !important;
}

:deep(.ant-menu-item-selected .anticon),
:deep(
    .ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item-selected .anticon
  ) {
  color: #1890ff !important;
}

:deep(.ant-menu-item-selected span),
:deep(.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item-selected span) {
  color: #1890ff !important;
}

/* 减小菜单项高度和间距 */
:deep(.ant-menu-horizontal > .ant-menu-item),
:deep(.ant-menu-horizontal > .ant-menu-submenu) {
  padding: 0 10px !important;
  margin: 0 !important;
  height: 46px !important;
  line-height: 46px !important;
}

:deep(.ant-menu-inline .ant-menu-item) {
  height: 32px !important;
  line-height: 32px !important;
  padding: 0 12px !important;
  margin: 2px 0 !important;
}

/* 水平菜单边框调整 */
:deep(.ant-menu-horizontal > .ant-menu-item-selected)::after,
:deep(.ant-menu-horizontal > .ant-menu-item-active)::after {
  border-bottom: 2px solid #1890ff !important;
  left: 10px !important;
  right: 10px !important;
}

/* 添加直接的全局样式覆盖 */
:global(.ant-menu-item),
:global(.ant-menu-item span),
:global(.ant-menu-item .anticon) {
  color: #ffffff !important;
}
</style>
