import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { ref, computed } from 'vue';

// 创建Solana连接（保持向后兼容）
export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// 导入钱包状态（从useWallet上下文）
// 这些导出是为了向后兼容，但推荐直接使用 useWallet() Hook
export const connected = ref(false);
export const walletAddress = ref('');
export const walletPublicKey = ref<PublicKey | null>(null);
export const walletBalance = ref(0);

// 当前使用的钱包适配器
let currentWalletAdapter: any = null;

// 更新钱包状态（供钱包组件调用）
export function setWalletState(adapter: any, pubKey: PublicKey | null) {
  currentWalletAdapter = adapter;
  walletPublicKey.value = pubKey;
  connected.value = !!pubKey;

  if (pubKey) {
    walletAddress.value = pubKey.toString().slice(0, 4) + '..' + pubKey.toString().slice(-4);
  } else {
    walletAddress.value = '';
  }
}

// 更新余额
export async function updateBalance() {
  if (!walletPublicKey.value) return;

  try {
    const balance = await connection.getBalance(walletPublicKey.value);
    walletBalance.value = balance / 1e9; // 转换为SOL
  } catch (error) {
    // 获取余额失败，静默处理
  }
}

// 连接钱包（保留向后兼容，但现在推荐使用 useWallet Hook）
export async function connectWallet() {
  // 这个函数现在主要作为向后兼容的接口
  // 实际的钱包连接逻辑在 useWallet Hook 中
  return false;
}

// 断开钱包连接（保留向后兼容）
export function disconnectWallet() {
  currentWalletAdapter = null;
  walletPublicKey.value = null;
  walletAddress.value = '';
  walletBalance.value = 0;
  connected.value = false;
}

// 获取当前钱包适配器
export function getCurrentWallet() {
  return currentWalletAdapter;
}

// 获取钱包公钥
export function getWalletPublicKey() {
  return walletPublicKey.value;
}
