<script setup lang="ts">
import { computed } from 'vue';
import Wallet from './wallet.vue';
import {
  HomeOutlined,
  PlusOutlined,
  SendOutlined,
  FireOutlined,
  LockOutlined,
  LinkOutlined,
  UploadOutlined,
  FileTextOutlined,
  HistoryOutlined,
  ToolOutlined,
  RightOutlined,
} from '@ant-design/icons-vue';

// 定义菜单项配置
interface PageConfig {
  key: string;
  title: string;
  icon: any;
}

const props = defineProps<{
  activeKey?: string;
  sidebarCollapsed?: boolean;
}>();

// 页面配置映射
const pageConfigs: PageConfig[] = [
  { key: 'token-list', title: '代币列表', icon: HomeOutlined },
  { key: 'create-token', title: '创建代币', icon: PlusOutlined },
  { key: 'mint-token', title: '铸造代币', icon: ToolOutlined },
  { key: 'transfer-token', title: '转账代币', icon: SendOutlined },
  { key: 'burn-token', title: '销毁代币', icon: FireOutlined },
  { key: 'freeze-manage', title: '冻结管理', icon: LockOutlined },
  { key: 'create-associated', title: '创建关联账户', icon: LinkOutlined },
  { key: 'ipfs-upload', title: 'IPFS上传', icon: UploadOutlined },
  { key: 'set-metadata', title: '设置Metadata', icon: FileTextOutlined },
  { key: 'transaction-history', title: '交易历史', icon: HistoryOutlined },
];

// 当前页面配置
const currentPage = computed(() => {
  const page = pageConfigs.find(page => page.key === props.activeKey) || pageConfigs[0];
  console.log('Header - activeKey:', props.activeKey);
  console.log('Header - currentPage:', page);
  console.log('Header - page.icon:', page.icon);
  console.log('Header - page.title:', page.title);
  console.log('Header - page exists:', !!page);
  console.log('Header - page.title exists:', !!page?.title);
  return page;
});
</script>

<template>
  <div class="header" :class="{ 'header-collapsed': sidebarCollapsed }">
    <div class="header-inner">
      <div class="header-content">
        <!-- 左侧页面指示区域 -->
        <div class="header-left">
          <div class="page-indicator" v-if="currentPage && currentPage.title">
            <component :is="currentPage.icon" class="indicator-icon" />
            <span class="indicator-text">{{ currentPage.title }}</span>
            <RightOutlined class="arrow-icon" />
          </div>
        </div>

        <!-- 右侧钱包区域 -->
        <div class="header-right">
          <Wallet />
        </div>
      </div>
      <div class="header-border"></div>
    </div>
  </div>
</template>

<style scoped>
.header {
  position: fixed;
  top: 0;
  right: 0;
  left: 240px;
  height: 80px;
  z-index: 999;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-collapsed {
  left: 80px;
}

.header-inner {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, rgba(11, 19, 43, 0.98) 0%, rgba(26, 34, 53, 0.98) 100%);
  backdrop-filter: blur(20px);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  position: relative;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 16px;
  width: 100%;
  height: calc(100% - 1px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  flex: 1;
}

/* 页面指示区域 */
.page-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.page-indicator:hover {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.indicator-icon {
  font-size: 16px;
  color: #14F195;
  flex-shrink: 0;
}

.indicator-text {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.5px;
}

.arrow-icon {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

/* 右侧钱包区域 */
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

/* 底部分割线 */
.header-border {
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(20, 241, 149, 0.3) 15%,
    rgba(153, 69, 255, 0.4) 50%,
    rgba(20, 241, 149, 0.3) 85%,
    transparent 100%
  );
  flex-shrink: 0;
  position: absolute;
  bottom: 0;
  left: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header {
    left: 0;
    height: 70px;
  }

  .header-content {
    padding: 0 16px;
    gap: 16px;
  }

  .header-left {
    gap: 16px;
  }

  .page-indicator {
    padding: 6px 12px;
    gap: 6px;
  }

  .indicator-icon {
    font-size: 14px;
  }

  .indicator-text {
    font-size: 13px;
  }

  .arrow-icon {
    font-size: 12px;
  }
}
</style>
