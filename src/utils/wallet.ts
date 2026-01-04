import { Connection, PublicKey, clusterApiUrl, Keypair } from '@solana/web3.js';
import { ref } from 'vue';

// 创建Solana连接
export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// 钱包状态
export const connected = ref(false);
export const walletAddress = ref('');
export const walletPublicKey = ref<PublicKey | null>(null);
export const walletBalance = ref(0);

// 当前使用的钱包或临时生成的Keypair
let currentWallet: Keypair | null = null;

// 连接钱包
export const connectWallet = async () => {
  try {
    // 这里简化处理，实际应用中应使用真实的钱包适配器如Phantom、Solflare等
    // 在这个示例中，我们生成一个临时的钱包用于演示
    currentWallet = Keypair.generate();
    walletPublicKey.value = currentWallet.publicKey;
    walletAddress.value = currentWallet.publicKey.toString().slice(0, 4) + '..' + 
                          currentWallet.publicKey.toString().slice(-4);
    
    // 获取钱包余额
    await updateBalance();
    
    connected.value = true;
    return true;
  } catch (error) {
    console.error('连接钱包失败:', error);
    return false;
  }
};

// 断开钱包连接
export const disconnectWallet = () => {
  currentWallet = null;
  walletPublicKey.value = null;
  walletAddress.value = '';
  walletBalance.value = 0;
  connected.value = false;
};

// 更新钱包余额
export const updateBalance = async () => {
  if (!walletPublicKey.value) return;
  
  try {
    const balance = await connection.getBalance(walletPublicKey.value);
    walletBalance.value = balance / 10**9; // 转换为SOL
  } catch (error) {
    console.error('获取余额失败:', error);
  }
};

// 获取当前钱包
export const getCurrentWallet = () => currentWallet; 