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
  <div 
    class="fixed top-0 right-0 h-20 z-[999] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:left-0 md:h-[70px]" 
    :class="sidebarCollapsed ? 'left-20' : 'left-[240px]'"
  >
    <div class="w-full h-full bg-gradient-to-r from-[rgba(11,19,43,0.98)] to-[rgba(26,34,53,0.98)] backdrop-blur-[20px] shadow-[0_2px_20px_rgba(0,0,0,0.3)] flex flex-col relative">
      <div class="w-full h-full flex items-center justify-between px-4 pr-[10px] gap-6 md:px-4 md:pr-[10px] md:gap-4">
        <!-- 左侧页面指示区域 -->
        <div class="flex items-center flex-1 min-w-0" style="flex: 1 1 auto; min-width: 0; display: flex !important; align-items: center !important; overflow: visible !important; position: relative !important; z-index: 10 !important;">
          <div 
            v-if="currentPage && currentPage.title"
            class="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-300 ease-in-out hover:bg-white/5"
            style="display: flex !important; align-items: center !important; gap: 8px !important; padding: 8px 12px !important; border-radius: 8px !important; visibility: visible !important; opacity: 1 !important; width: auto !important; min-width: fit-content !important; position: relative !important; z-index: 10 !important; background: transparent !important;"
          >
            <component 
              :is="currentPage.icon" 
              style="font-size: 16px !important; color: #14F195 !important; flex-shrink: 0 !important; display: inline-block !important; width: 16px !important; height: 16px !important; visibility: visible !important; opacity: 1 !important; line-height: 1 !important; vertical-align: middle !important;"
            />
            <span 
              style="font-size: 14px !important; font-weight: 500 !important; color: rgba(255, 255, 255, 0.9) !important; letter-spacing: 0.5px !important; white-space: nowrap !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; line-height: 1.5 !important; vertical-align: middle !important;"
            >
              {{ currentPage.title }}
            </span>
            <RightOutlined 
              style="font-size: 14px !important; color: rgba(255, 255, 255, 0.5) !important; flex-shrink: 0 !important; margin-left: 2px !important; display: inline-block !important; width: 14px !important; height: 14px !important; visibility: visible !important; opacity: 1 !important; line-height: 1 !important; vertical-align: middle !important;"
            />
          </div>
        </div>

        <!-- 右侧钱包区域 -->
        <div class="flex items-center gap-2 shrink-0">
          <Wallet />
        </div>
      </div>
      <div class="w-full h-px bg-gradient-to-r from-transparent via-[rgba(20,241,149,0.3)] via-[rgba(153,69,255,0.4)] via-[rgba(20,241,149,0.3)] to-transparent shrink-0 absolute bottom-0 left-0"></div>
    </div>
  </div>
</template>

