<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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

// 当前搜索值
const searchValue = ref('');

// 将保存的 Mint 地址转换为 AutoComplete 选项格式，并根据搜索值过滤
const mintOptions = computed(() => {
  const allOptions = savedMints.value.map(mint => ({
    value: mint.address,
    label: mint.name || mint.symbol ? `${mint.name || ''} ${mint.symbol ? `(${mint.symbol})` : ''}`.trim() : undefined,
    name: mint.name,
    symbol: mint.symbol,
  }));
  
  // 如果搜索值为空，返回所有选项
  if (!searchValue.value || searchValue.value.trim() === '') {
    return allOptions;
  }
  
  // 否则根据搜索值过滤
  const searchText = searchValue.value.toLowerCase().trim();
  return allOptions.filter(option => 
    option.value?.toLowerCase().includes(searchText) ||
    (option.label && option.label.toLowerCase().includes(searchText)) ||
    (option.name && option.name.toLowerCase().includes(searchText)) ||
    (option.symbol && option.symbol.toLowerCase().includes(searchText))
  );
});

// 过滤选项函数（用于 Ant Design 的 filter-option）
const filterMintOptions = (input: string, option: any) => {
  // 更新搜索值
  searchValue.value = input || '';
  // 如果输入为空，显示所有选项
  if (!input || input.trim() === '') {
    return true;
  }
  const searchText = input.toLowerCase().trim();
  return (
    option.value?.toLowerCase().includes(searchText) ||
    (option.label && option.label.toLowerCase().includes(searchText)) ||
    (option.name && option.name.toLowerCase().includes(searchText)) ||
    (option.symbol && option.symbol.toLowerCase().includes(searchText))
  );
};

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
  set: (value: string) => {
    emit('update:modelValue', value);
    // 当值被清空时，也清空搜索值
    if (!value || value.trim() === '') {
      searchValue.value = '';
    }
  },
});

// 监听 inputValue 变化，同步更新 searchValue
watch(() => props.modelValue, (newValue) => {
  if (!newValue || newValue.trim() === '') {
    searchValue.value = '';
  }
});

// 处理搜索事件
const handleSearch = (value: string) => {
  searchValue.value = value || '';
};
</script>

<template>
  <div>
    <div class="relative w-full">
      <a-auto-complete
        v-model:value="inputValue"
        size="large"
        :options="mintOptions"
        :filter-option="false"
        :default-active-first-option="false"
        class="w-full"
        :class="{ '!border-solana-green': inputValue && isValidSolanaAddress(inputValue) }"
        :dropdown-style="{ background: 'rgba(26, 34, 53, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)' }"
        @search="handleSearch"
      >
        <template #getInputElement="{ value, onChange }">
          <a-input
            :value="value"
            @input="onChange"
            :placeholder="placeholder || t('tokenList.selectMintAddressPlaceholder')"
            class="pr-10"
            :class="{ '!border-solana-green': value && isValidSolanaAddress(value) }"
          />
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
      <button
        v-if="inputValue"
        type="button"
        @click="inputValue = ''"
        class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-500/20 transition-colors z-30 cursor-pointer"
        style="pointer-events: auto; margin-top: 0;"
      >
        <CloseCircleOutlined class="text-red-400 hover:text-red-500 transition-colors" style="font-size: 16px; width: 16px; height: 16px; display: block; flex-shrink: 0;" />
      </button>
    </div>
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
:deep(.ant-input-affix-wrapper),
:deep(.ant-auto-complete .ant-input-affix-wrapper) {
  padding-right: 36px !important;
}

:deep(.ant-input-clear-icon),
:deep(.ant-input-affix-wrapper .ant-input-clear-icon),
:deep(.ant-auto-complete .ant-input-clear-icon),
:deep(.ant-auto-complete .ant-input-affix-wrapper .ant-input-clear-icon) {
  background: transparent !important;
  background-color: transparent !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 50% !important;
  width: 32px !important;
  height: 32px !important;
  min-width: 32px !important;
  min-height: 32px !important;
  max-width: 32px !important;
  max-height: 32px !important;
  padding: 0 !important;
  margin: 0 !important;
  right: 4px !important;
  transition: all 0.2s ease !important;
  opacity: 1 !important;
  visibility: visible !important;
  z-index: 10 !important;
  overflow: visible !important;
  box-sizing: border-box !important;
}

:deep(.ant-input-clear-icon:hover),
:deep(.ant-input-affix-wrapper .ant-input-clear-icon:hover),
:deep(.ant-auto-complete .ant-input-clear-icon:hover),
:deep(.ant-auto-complete .ant-input-affix-wrapper .ant-input-clear-icon:hover) {
  background-color: rgba(239, 68, 68, 0.1) !important;
}

:deep(.ant-input-clear-icon .anticon),
:deep(.ant-input-affix-wrapper .ant-input-clear-icon .anticon),
:deep(.ant-auto-complete .ant-input-clear-icon .anticon),
:deep(.ant-auto-complete .ant-input-affix-wrapper .ant-input-clear-icon .anticon),
:deep(.ant-input-clear-icon svg),
:deep(.ant-input-affix-wrapper .ant-input-clear-icon svg),
:deep(.ant-auto-complete .ant-input-clear-icon svg),
:deep(.ant-auto-complete .ant-input-affix-wrapper .ant-input-clear-icon svg) {
  border-radius: 50% !important;
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  min-height: 28px !important;
  max-width: 28px !important;
  max-height: 28px !important;
  font-size: 28px !important;
  line-height: 28px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: #ef4444 !important;
  padding: 0 !important;
  margin: 0 !important;
  box-sizing: border-box !important;
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

