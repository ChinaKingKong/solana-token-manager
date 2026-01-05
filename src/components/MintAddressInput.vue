<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CloseCircleOutlined } from '@ant-design/icons-vue';
import { useTokenMints } from '../composables/useTokenMints';
import { PublicKey } from '@solana/web3.js';

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  desc?: string;
  showDesc?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const { t } = useI18n();
const { savedMints } = useTokenMints();

// 将保存的 Mint 地址转换为 AutoComplete 选项格式
const mintOptions = computed(() => {
  return savedMints.value.map(mint => ({
    value: mint.address,
    label: mint.name || mint.symbol ? `${mint.name || ''} ${mint.symbol ? `(${mint.symbol})` : ''}`.trim() : undefined,
    name: mint.name,
    symbol: mint.symbol,
  }));
});

// 过滤选项函数 - 使用 computed 来避免在渲染函数外调用
const filterMintOptions = computed(() => {
  return (input: string, option: any) => {
    if (!input) return true;
    const searchText = input.toLowerCase();
    return (
      option.value?.toLowerCase().includes(searchText) ||
      (option.label && option.label.toLowerCase().includes(searchText))
    );
  };
});

// 验证Solana地址格式
const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};

const inputValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
});
</script>

<template>
  <div>
    <a-auto-complete
      v-model:value="inputValue"
      size="large"
      :options="mintOptions"
      :filter-option="filterMintOptions.value"
      class="w-full"
      :class="{ '!border-solana-green': inputValue && isValidSolanaAddress(inputValue) }"
      :dropdown-style="{ background: 'rgba(26, 34, 53, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)' }"
    >
      <template #getInputElement>
        <a-input
          :placeholder="placeholder || t('tokenList.selectMintAddressPlaceholder')"
          allow-clear
        >
          <template #clearIcon>
            <CloseCircleOutlined class="text-red-400 hover:text-red-500 transition-colors rounded-full" />
          </template>
        </a-input>
      </template>
      <template #option="option">
        <div class="flex flex-col min-w-0">
          <div class="font-mono text-sm truncate text-white">{{ option.value }}</div>
          <div v-if="option.label" class="text-xs text-white/80 truncate mt-0.5">
            {{ option.label }}
          </div>
        </div>
      </template>
    </a-auto-complete>
    <div v-if="showDesc !== false && (desc || $slots.desc)" class="mt-1.5 text-xs text-white/50">
      <slot name="desc">{{ desc }}</slot>
    </div>
    <div v-if="inputValue && !isValidSolanaAddress(inputValue)" class="mt-1.5 text-xs text-red-400">
      <slot name="error">{{ t('common.addressInvalid') || '地址格式无效' }}</slot>
    </div>
  </div>
</template>

<style scoped>
/* 输入框和下拉框样式覆盖 */
:deep(.ant-input),
:deep(.ant-input-number-input),
:deep(.ant-select-selector),
:deep(.ant-input-affix-wrapper) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-select-selection-search-input),
:deep(.ant-input-affix-wrapper .ant-input) {
  color: rgba(255, 255, 255, 0.9) !important;
  background-color: transparent !important;
}

:deep(.ant-select-selection-placeholder),
:deep(.ant-input-affix-wrapper .ant-input::placeholder) {
  color: rgba(255, 255, 255, 0.4) !important;
}

:deep(.ant-input:focus),
:deep(.ant-input-focused),
:deep(.ant-input-number-focused .ant-input-number-input),
:deep(.ant-select-focused .ant-select-selector),
:deep(.ant-input-affix-wrapper-focused) {
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-color: #14f195 !important;
  box-shadow: 0 0 0 2px rgba(20, 241, 149, 0.2) !important;
}

:deep(.ant-input-affix-wrapper-focused .ant-input) {
  background-color: transparent !important;
}

/* 清除图标样式 - 圆角处理 */
:deep(.ant-input-clear-icon),
:deep(.ant-input-affix-wrapper .ant-input-clear-icon) {
  background: transparent !important;
  background-color: transparent !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 50% !important;
  width: 20px !important;
  height: 20px !important;
  transition: all 0.2s ease !important;
}

:deep(.ant-input-clear-icon:hover),
:deep(.ant-input-affix-wrapper .ant-input-clear-icon:hover) {
  background-color: rgba(239, 68, 68, 0.1) !important;
}

:deep(.ant-input-clear-icon .anticon),
:deep(.ant-input-affix-wrapper .ant-input-clear-icon .anticon) {
  border-radius: 50% !important;
  width: 16px !important;
  height: 16px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* AutoComplete 下拉选项样式 */
:deep(.ant-select-dropdown),
:deep(.ant-cascader-dropdown) {
  background: rgba(26, 34, 53, 0.95) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.ant-select-item),
:deep(.ant-cascader-menu-item) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-select-item-option-selected) {
  background: rgba(20, 241, 149, 0.2) !important;
  color: #14f195 !important;
}

:deep(.ant-select-item-option-active:not(.ant-select-item-option-disabled)) {
  background: rgba(20, 241, 149, 0.1) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-select-item-option-content) {
  color: inherit !important;
}

/* AutoComplete 选项文字颜色 */
:deep(.ant-select-item-option) {
  color: white !important;
}

:deep(.ant-select-item-option .ant-select-item-option-content) {
  color: white !important;
}
</style>

