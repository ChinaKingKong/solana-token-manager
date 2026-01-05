<script setup lang="ts">
import { computed } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import Wallet from './wallet.vue';
import { useWallet } from '../hooks/useWallet';
import type { NetworkType } from '../config/rpc';
import {
  HomeOutlined,
  PlusOutlined,
  SendOutlined,
  FireOutlined,
  LockOutlined,
  UploadOutlined,
  FileTextOutlined,
  HistoryOutlined,
  ToolOutlined,
  RightOutlined,
  GlobalOutlined,
  TranslationOutlined,
} from '@ant-design/icons-vue';

// 定义菜单项配置
interface PageConfig {
  key: string;
  titleKey: string;
  icon: any;
}

const props = defineProps<{
  activeKey?: string;
  sidebarCollapsed?: boolean;
}>();

const { t, locale } = useI18n();

// 页面配置映射
const pageConfigs: PageConfig[] = [
  { key: 'token-list', titleKey: 'header.tokenList', icon: HomeOutlined },
  { key: 'create-token', titleKey: 'header.createToken', icon: PlusOutlined },
  { key: 'mint-token', titleKey: 'header.mintToken', icon: ToolOutlined },
  { key: 'transfer-token', titleKey: 'header.transferToken', icon: SendOutlined },
  { key: 'burn-token', titleKey: 'header.burnToken', icon: FireOutlined },
  { key: 'freeze-manage', titleKey: 'header.freezeManage', icon: LockOutlined },
  { key: 'ipfs-upload', titleKey: 'header.ipfsUpload', icon: UploadOutlined },
  { key: 'set-metadata', titleKey: 'header.setMetadata', icon: FileTextOutlined },
  { key: 'transaction-history', titleKey: 'header.transactionHistory', icon: HistoryOutlined },
];

// 当前页面配置
const currentPage = computed(() => {
  const page = pageConfigs.find(page => page.key === props.activeKey) || pageConfigs[0];
  return {
    ...page,
    title: t(page.titleKey),
  };
});

// 钱包上下文
const { network, switchNetwork } = useWallet();

// 网络选项
const networkOptions = computed(() => [
  { label: t('header.mainnet'), value: 'mainnet' as NetworkType },
  { label: t('header.devnet'), value: 'devnet' as NetworkType },
]);

// 当前网络显示文本
const currentNetworkLabel = computed(() => {
  const currentNetwork = network.value;
  return networkOptions.value.find(opt => opt.value === currentNetwork)?.label || t('header.mainnet');
});

// 切换网络
const handleNetworkChange = (newNetwork: NetworkType) => {
  if (network.value === newNetwork) return;
  
  try {
    switchNetwork(newNetwork);
    const networkLabel = networkOptions.value.find(opt => opt.value === newNetwork)?.label;
    message.success(`${t('header.networkSwitched')}${networkLabel}`);
  } catch (error) {
    message.error(t('header.networkSwitchFailed'));
  }
};

// 语言选项
const languageOptions = [
  { label: '中文', value: 'zh', flag: '🇨🇳' },
  { label: 'English', value: 'en', flag: '🇺🇸' },
];

// 当前语言
const currentLanguage = computed(() => {
  return languageOptions.find(opt => opt.value === locale.value) || languageOptions[0];
});

// 切换语言
const handleLanguageChange = (newLocale: string) => {
  if (locale.value === newLocale) return;
  locale.value = newLocale;
  localStorage.setItem('locale', newLocale);
  message.success(newLocale === 'zh' ? '已切换到中文' : 'Switched to English');
};
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
          <!-- 语言切换按钮 -->
          <a-dropdown trigger="click" placement="bottomRight">
            <a-button class="language-switch-btn">
              <template #icon><TranslationOutlined /></template>
              {{ currentLanguage.flag }} {{ currentLanguage.label }}
            </a-button>
            <template #overlay>
              <a-menu @click="({ key }) => handleLanguageChange(key as string)">
                <a-menu-item 
                  v-for="option in languageOptions" 
                  :key="option.value"
                  :class="{ 'ant-menu-item-selected': locale === option.value }"
                >
                  {{ option.flag }} {{ option.label }}
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
          <!-- 网络切换按钮 -->
          <a-dropdown trigger="click" placement="bottomRight">
            <a-button class="network-switch-btn">
              <template #icon><GlobalOutlined /></template>
              {{ currentNetworkLabel }}
            </a-button>
            <template #overlay>
              <a-menu @click="({ key }) => handleNetworkChange(key as NetworkType)">
                <a-menu-item 
                  v-for="option in networkOptions" 
                  :key="option.value"
                  :class="{ 'ant-menu-item-selected': network.value === option.value }"
                >
                  {{ option.label }}
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
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
  gap: 12px;
  flex-shrink: 0;
}

/* 语言切换按钮 */
.language-switch-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  height: 40px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.3s ease;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 4px;
}

.language-switch-btn:hover {
  background: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  color: #ffffff !important;
}

/* 网络切换按钮 */
.network-switch-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  height: 40px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.3s ease;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 1px;
}

.network-switch-btn:hover {
  background: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  color: #ffffff !important;
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
