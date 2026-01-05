import { ref, computed, watch } from 'vue';

const STORAGE_KEY = 'saved-token-mints';

interface TokenMint {
  address: string;
  name?: string;
  symbol?: string;
  createdAt: number;
}

// 从 localStorage 读取保存的 Mint 地址列表
const loadSavedMints = (): TokenMint[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    // 加载保存的 Mint 地址失败，静默处理
  }
  return [];
};

// 保存 Mint 地址列表到 localStorage
const saveMints = (mints: TokenMint[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mints));
  } catch (error) {
    // 保存 Mint 地址失败，静默处理
  }
};

// 保存的 Mint 地址列表
const savedMints = ref<TokenMint[]>(loadSavedMints());

// 监听变化并保存
watch(savedMints, (newMints) => {
  saveMints(newMints);
}, { deep: true });

/**
 * 添加新的 Mint 地址
 */
export const addTokenMint = (address: string, name?: string, symbol?: string) => {
  // 检查是否已存在
  const exists = savedMints.value.some(mint => mint.address === address);
  if (exists) {
    return;
  }

  const newMint: TokenMint = {
    address,
    name,
    symbol,
    createdAt: Date.now(),
  };

  savedMints.value.push(newMint);
  // 按创建时间倒序排列（最新的在前）
  savedMints.value.sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * 删除 Mint 地址
 */
export const removeTokenMint = (address: string) => {
  const index = savedMints.value.findIndex(mint => mint.address === address);
  if (index > -1) {
    savedMints.value.splice(index, 1);
  }
};

/**
 * 获取所有保存的 Mint 地址
 */
export const getSavedMints = computed(() => savedMints.value);

/**
 * 清空所有保存的 Mint 地址
 */
export const clearAllMints = () => {
  savedMints.value = [];
};

/**
 * 使用保存的 Mint 地址列表的 composable
 */
export const useTokenMints = () => {
  return {
    savedMints: getSavedMints,
    addTokenMint,
    removeTokenMint,
    clearAllMints,
  };
};

