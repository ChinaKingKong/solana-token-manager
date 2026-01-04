import { ref, computed, inject, provide } from 'vue';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'; 
import {
  PhantomWalletAdapter,
  CoinbaseWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { getRpcEndpoint, DEFAULT_NETWORK, type NetworkType } from '../config/rpc';

// 钱包状态接口
export interface WalletState {
  wallet: any;
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  balance: number;
}

// 钱包上下文Key
const WALLET_KEY = Symbol('wallet');

// 钱包上下文接口
export interface WalletContext {
  walletState: ReturnType<typeof useWalletProvider>['walletState'];
  supportedWallets: any[];
  connection: ReturnType<typeof useWalletProvider>['connection'];
  endpoint: string;
  network: NetworkType;
  connectWallet: (walletAdapter: any) => Promise<boolean>;
  disconnectWallet: () => Promise<void>;
  autoConnect: () => Promise<boolean>;
  fetchBalance: () => Promise<void>;
  sendTransaction: (transaction: any) => Promise<string>;
  signTransaction: (transaction: any) => Promise<any>;
  signAllTransactions: (transactions: any[]) => Promise<any[]>;
}

// 创建钱包提供者Hook
export function useWalletProvider() {
  // 状态
  const wallet = ref<any>(null);
  const publicKey = ref<PublicKey | null>(null);
  const connected = ref(false);
  const connecting = ref(false);
  const disconnecting = ref(false);
  const balance = ref(0);

  // 连接配置
  const network: NetworkType = DEFAULT_NETWORK;
  const endpoint = getRpcEndpoint(network);
  const connection = ref(new Connection(endpoint, 'confirmed'));

  // 支持的钱包列表
  const supportedWallets = [
    new PhantomWalletAdapter(),
    new CoinbaseWalletAdapter(),
  ];

  // 连接指定钱包
  const connectWallet = async (walletAdapter: any) => {
    if (connecting.value) return;

    console.log('🔑 开始连接钱包...');
    console.log('钱包适配器:', walletAdapter.name);

    connecting.value = true;
    try {
      await walletAdapter.connect();
      wallet.value = walletAdapter;

      console.log('钱包连接成功');
      console.log('公钥对象:', walletAdapter.publicKey);
      console.log('公钥类型:', typeof walletAdapter.publicKey);

      if (!walletAdapter.publicKey) {
        throw new Error('钱包公钥为空');
      }

      publicKey.value = walletAdapter.publicKey;
      connected.value = true;

      console.log('✅ 公钥已设置:', publicKey.value?.toString() || '未知');

      // 获取余额
      await fetchBalance();

      return true;
    } catch (error) {
      console.error('❌ 钱包连接失败:', error);
      throw error;
    } finally {
      connecting.value = false;
    }
  };

  // 自动连接（尝试所有钱包）
  const autoConnect = async () => {
    for (const walletAdapter of supportedWallets) {
      try {
        const result = await connectWallet(walletAdapter);
        if (result) return true;
      } catch (error) {
        console.log(`${walletAdapter.name} 连接失败，尝试下一个钱包`);
      }
    }
    return false;
  };

  // 断开连接
  const disconnectWallet = async () => {
    if (disconnecting.value || !wallet.value) return;

    disconnecting.value = true;
    try {
      await wallet.value.disconnect();
      wallet.value = null;
      publicKey.value = null;
      connected.value = false;
      balance.value = 0;
    } catch (error) {
      console.error('断开钱包连接失败:', error);
      throw error;
    } finally {
      disconnecting.value = false;
    }
  };

  // 获取余额
  const fetchBalance = async () => {
    if (!publicKey.value) {
      balance.value = 0;
      return;
    }

    try {
      console.log('正在获取SOL余额...');
      console.log('公钥:', publicKey.value.toString());
      console.log('RPC端点:', connection.value.rpcEndpoint);

      const lamports = await connection.value.getBalance(publicKey.value);
      balance.value = lamports / LAMPORTS_PER_SOL;

      console.log('✅ 成功获取SOL余额:', balance.value, 'SOL');
      console.log('Lamports:', lamports);
    } catch (error: any) {
      console.error('❌ 获取SOL余额失败:', error);
      console.error('错误详情:', error.message);
      balance.value = 0;
    }
  };

  // 发送交易
  const sendTransaction = async (transaction: any) => {
    if (!wallet.value) {
      throw new Error('钱包未连接');
    }

    try {
      const signature = await wallet.value.sendTransaction(transaction, connection.value);
      await connection.value.confirmTransaction(signature);
      return signature;
    } catch (error) {
      console.error('发送交易失败:', error);
      throw error;
    }
  };

  // 签名交易
  const signTransaction = async (transaction: any) => {
    if (!wallet.value) {
      throw new Error('钱包未连接');
    }

    try {
      return await wallet.value.signTransaction(transaction);
    } catch (error) {
      console.error('签名交易失败:', error);
      throw error;
    }
  };

  // 签名多条交易
  const signAllTransactions = async (transactions: any[]) => {
    if (!wallet.value) {
      throw new Error('钱包未连接');
    }

    try {
      return await wallet.value.signAllTransactions(transactions);
    } catch (error) {
      console.error('签名所有交易失败:', error);
      throw error;
    }
  };

  // 钱包状态
  const walletState = computed<WalletState>(() => ({
    wallet: wallet.value,
    publicKey: publicKey.value,
    connected: connected.value,
    connecting: connecting.value,
    disconnecting: disconnecting.value,
    balance: balance.value,
  }));

  // 提供上下文
  provide(WALLET_KEY, {
    walletState,
    supportedWallets,
    connection,
    endpoint,
    network,
    connectWallet,
    disconnectWallet,
    autoConnect,
    fetchBalance,
    sendTransaction,
    signTransaction,
    signAllTransactions,
  });

  return {
    walletState,
    supportedWallets,
    connection,
  };
}

// 使用钱包Hook
export function useWallet(): WalletContext {
  const walletContext = inject<WalletContext>(WALLET_KEY);

  if (!walletContext) {
    throw new Error('useWallet must be used within WalletProvider');
  }

  return walletContext;
}
