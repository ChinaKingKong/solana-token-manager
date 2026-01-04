<script setup lang="ts">
import {
  HomeOutlined,
  PlusOutlined,
  SendOutlined,
  FireOutlined,
  LockOutlined,
  UploadOutlined,
  FileTextOutlined,
  HistoryOutlined,
  CloseOutlined,
  MenuOutlined,
  ToolOutlined,
  LinkOutlined,
} from '@ant-design/icons-vue';

// 定义菜单项
interface MenuItem {
  key: string;
  label: string;
  icon: any;
}

const menuItems: MenuItem[] = [
  {
    key: 'token-list',
    label: '代币列表',
    icon: HomeOutlined,
  },
  {
    key: 'create-token',
    label: '创建代币',
    icon: PlusOutlined,
  },
  {
    key: 'mint-token',
    label: '铸造代币',
    icon: ToolOutlined,
  },
  {
    key: 'transfer-token',
    label: '转账代币',
    icon: SendOutlined,
  },
  {
    key: 'burn-token',
    label: '销毁代币',
    icon: FireOutlined,
  },
  {
    key: 'freeze-manage',
    label: '冻结管理',
    icon: LockOutlined,
  },
  {
    key: 'create-associated',
    label: '创建关联账户',
    icon: LinkOutlined,
  },
  {
    key: 'ipfs-upload',
    label: 'IPFS上传',
    icon: UploadOutlined,
  },
  {
    key: 'set-metadata',
    label: '设置Metadata',
    icon: FileTextOutlined,
  },
  {
    key: 'transaction-history',
    label: '交易历史',
    icon: HistoryOutlined,
  },
];

// 接收外部传入的 activeKey
const props = defineProps<{
  activeKey?: string;
  collapsed?: boolean;
}>();

// emit事件
const emit = defineEmits<{
  (e: 'menu-select', key: string): void;
  (e: 'toggle-collapse'): void;
}>();

// 处理菜单选择
const handleMenuSelect = (key: string) => {
  emit('menu-select', key);
};

// 切换侧边栏折叠状态
const toggleCollapse = () => {
  emit('toggle-collapse');
};
</script>

<template>
  <div class="sidebar" :class="{ 'sidebar-collapsed': props.collapsed }">
    <!-- Logo区域 -->
    <div class="sidebar-header">
      <div class="logo-container">
        <img src="/favicon.png" alt="Solana Token Manager" class="logo-image" />
        <transition name="fade">
          <div v-if="!props.collapsed" class="logo-text">
            <div class="logo-title">Solana Token Manager</div> 
          </div>
        </transition>
      </div>
    </div>

    <!-- 菜单区域 -->
    <div class="sidebar-menu">
      <div v-for="item in menuItems" :key="item.key" class="menu-item"
        :class="{ 'menu-item-active': props.activeKey === item.key }" @click="handleMenuSelect(item.key)">
        <component :is="item.icon" class="menu-icon" />
        <transition name="fade">
          <span v-if="!props.collapsed" class="menu-label">{{ item.label }}</span>
        </transition>
      </div>
    </div>

    <!-- 底部折叠按钮 -->
    <div class="sidebar-footer">
      <div class="collapse-btn" @click="toggleCollapse">
        <CloseOutlined v-if="!props.collapsed" class="collapse-icon" />
        <MenuOutlined v-else class="collapse-icon" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  width: 240px;
  background: linear-gradient(180deg, #0B132B 0%, #1A2235 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
}

.sidebar-collapsed {
  width: 80px;
}

.sidebar-header {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.sidebar-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg,
      transparent 0%,
      rgba(20, 241, 149, 0.3) 50%,
      transparent 100%);
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-image {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
}

.logo-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  white-space: nowrap;
  line-height: 1.2;
}

.logo-title {
  font-size: 13px;
  font-weight: 700;
  background: linear-gradient(135deg, #14F195 0%, #9945FF 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.3px;
}

.logo-subtitle {
  font-size: 11px;
  font-weight: 600;
  background: linear-gradient(135deg, #14F195 0%, #9945FF 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.2px;
}

.sidebar-menu {
  flex: 1;
  padding: 16px 8px;
  overflow-y: auto;
  overflow-x: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.7);
  gap: 12px;
}

.menu-item:hover {
  background: rgba(20, 241, 149, 0.1);
  color: #14F195;
}

.menu-item-active {
  background: linear-gradient(90deg, rgba(20, 241, 149, 0.2) 0%, rgba(20, 241, 149, 0.05) 100%);
  color: #14F195;
  box-shadow: 0 2px 8px rgba(20, 241, 149, 0.2);
}

.menu-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.menu-label {
  font-size: 14px;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.7);
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #14F195;
}

.collapse-icon {
  font-size: 16px;
  transition: all 0.3s ease;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 滚动条样式 */
.sidebar-menu::-webkit-scrollbar {
  width: 4px;
}

.sidebar-menu::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.sidebar-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
