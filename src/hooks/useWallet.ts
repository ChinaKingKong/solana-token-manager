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
  network: ReturnType<typeof useWalletProvider>['network'];
  switchNetwork: (network: NetworkType) => void;
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

  // 连接配置 - 从 localStorage 读取或使用默认值
  const getStoredNetwork = (): NetworkType => {
    const stored = localStorage.getItem('solana-network');
    if (stored && (stored === 'mainnet' || stored === 'devnet')) {
      return stored as NetworkType;
    }
    return DEFAULT_NETWORK;
  };

  const network = ref<NetworkType>(getStoredNetwork());
  const endpoint = computed(() => getRpcEndpoint(network.value));
  
  // 将 connection 改为 computed，使其自动响应网络变化
  const connection = computed(() => {
    return new Connection(endpoint.value, 'confirmed');
  });

  // 切换网络
  const switchNetwork = (newNetwork: NetworkType) => {
    if (network.value === newNetwork) return;
    
    network.value = newNetwork;
    localStorage.setItem('solana-network', newNetwork);
    
    // connection 是 computed，会自动更新，这里只需要触发响应式更新
    // 如果已连接钱包，重新获取余额
    if (connected.value && publicKey.value) {
      fetchBalance();
    }
  };

  // 支持的钱包列表
  const supportedWallets = [
    new PhantomWalletAdapter(),
    new CoinbaseWalletAdapter(),
  ];

  // 连接指定钱包
  const connectWallet = async (walletAdapter: any) => {
    if (connecting.value) return;

    connecting.value = true;
    try {
      await walletAdapter.connect();
      wallet.value = walletAdapter;

      if (!walletAdapter.publicKey) {
        throw new Error('钱包公钥为空');
      }

      publicKey.value = walletAdapter.publicKey;
      connected.value = true;

      // 获取余额
      await fetchBalance();

      return true;
    } catch (error) {
      console.error('钱包连接失败:', error);
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
        // 尝试下一个钱包
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
      const lamports = await connection.value.getBalance(publicKey.value);
      balance.value = lamports / LAMPORTS_PER_SOL;
    } catch (error: any) {
      console.error('获取SOL余额失败:', error);
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
    switchNetwork,
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
    network,
    switchNetwork,
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
