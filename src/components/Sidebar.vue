<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWallet } from '../hooks/useWallet';
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
  GiftOutlined,
} from '@ant-design/icons-vue';

const { t } = useI18n();
const { network } = useWallet();

// 定义菜单项
interface MenuItem {
  key: string;
  labelKey: string;
  icon: any;
  showOnlyOnDevnet?: boolean;
}

const menuItemsConfig: MenuItem[] = [
  {
    key: 'token-list',
    labelKey: 'header.tokenList',
    icon: HomeOutlined,
  },
  {
    key: 'create-token',
    labelKey: 'header.createToken',
    icon: PlusOutlined,
  },
  {
    key: 'mint-token',
    labelKey: 'header.mintToken',
    icon: ToolOutlined,
  },
  {
    key: 'transfer-token',
    labelKey: 'header.transferToken',
    icon: SendOutlined,
  },
  {
    key: 'burn-token',
    labelKey: 'header.burnToken',
    icon: FireOutlined,
  },
  {
    key: 'freeze-manage',
    labelKey: 'header.freezeManage',
    icon: LockOutlined,
  },
  {
    key: 'ipfs-upload',
    labelKey: 'header.ipfsUpload',
    icon: UploadOutlined,
  },
  {
    key: 'set-metadata',
    labelKey: 'header.setMetadata',
    icon: FileTextOutlined,
  },
  {
    key: 'transaction-history',
    labelKey: 'header.transactionHistory',
    icon: HistoryOutlined,
  },
  {
    key: 'faucet',
    labelKey: 'header.faucet',
    icon: GiftOutlined,
    showOnlyOnDevnet: true,
  },
];

// 计算菜单项（使用国际化，并根据网络过滤）
const menuItems = computed(() => {
  return menuItemsConfig
    .filter(item => {
      // 如果菜单项只在devnet显示，检查当前网络
      if (item.showOnlyOnDevnet && network.value !== 'devnet') {
        return false;
      }
      return true;
    })
    .map(item => ({
      ...item,
      label: t(item.labelKey),
    }));
});

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
  <div class="fixed left-0 top-0 h-screen bg-gradient-to-b from-dark-bg to-dark-bg-light border-r border-white/10 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-[1000] shadow-[2px_0_8px_rgba(0,0,0,0.3)]" :class="props.collapsed ? 'w-20' : 'w-60'">
    <!-- Logo区域 -->
    <div class="h-20 flex items-center justify-start px-3 relative" style="height: 80px;">
      <div class="flex items-center gap-3">
        <img src="/favicon.png" alt="Solana Token Manager" class="w-[38px] h-[38px] rounded-full shrink-0" />
        <transition name="fade">
          <div v-if="!props.collapsed" class="flex flex-col gap-[1px] whitespace-nowrap leading-tight">
            <div class="text-[15px] font-[680] bg-gradient-solana bg-clip-text text-transparent tracking-[0.3px]">Solana Token Manager</div> 
          </div>
        </transition>
      </div>
      <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(20,241,149,0.3)] via-[rgba(153,69,255,0.4)] via-[rgba(20,241,149,0.3)] to-transparent"></div>
    </div>

    <!-- 菜单区域 -->
    <div class="flex-1 py-4 px-2 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb:hover]:bg-white/30">
      <div v-for="item in menuItems" :key="item.key" 
        class="flex items-center px-4 py-3 mb-1 rounded-lg cursor-pointer transition-all duration-200 ease-in-out text-white/70 gap-3 hover:bg-[rgba(20,241,149,0.1)] hover:text-solana-green"
        :class="{ 'bg-gradient-to-r from-[rgba(20,241,149,0.2)] to-[rgba(20,241,149,0.05)] text-solana-green shadow-[0_2px_8px_rgba(20,241,149,0.2)]': props.activeKey === item.key }"
        @click="handleMenuSelect(item.key)">
        <component :is="item.icon" class="text-lg shrink-0 flex items-center" />
        <transition name="fade">
          <span v-if="!props.collapsed" class="text-sm whitespace-nowrap flex items-center">{{ item.label }}</span>
        </transition>
      </div>
    </div>

    <!-- 底部折叠按钮 -->
    <div class="p-4 border-t border-white/10">
      <div class="flex items-center justify-center w-full p-2 rounded-lg cursor-pointer transition-all duration-200 ease-in-out text-white/70 hover:bg-white/10 hover:text-solana-green" @click="toggleCollapse">
        <CloseOutlined v-if="!props.collapsed" class="text-base transition-all duration-300 ease-in-out" />
        <MenuOutlined v-else class="text-base transition-all duration-300 ease-in-out" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
