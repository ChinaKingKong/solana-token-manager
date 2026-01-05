import { ref, computed, inject, provide, watch, onUnmounted } from 'vue';
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

  // 钱包事件监听器引用（用于清理）
  let walletEventListeners: Array<() => void> = [];
  let publicKeyWatchStop: (() => void) | null = null;
  let publicKeyPollInterval: number | null = null;

  // 设置钱包事件监听
  const setupWalletListeners = (walletAdapter: any) => {
    // 清理旧的事件监听器
    cleanupWalletListeners();

    if (!walletAdapter) return;

    // 方法1: 直接监听 window.solana 事件（Phantom 钱包）
    if (typeof window !== 'undefined' && (window as any).solana) {
      const phantom = (window as any).solana;
      
      const handlePhantomAccountChange = (newPublicKey: PublicKey | null) => {
        if (connected.value && walletAdapter === wallet.value) {
          if (newPublicKey) {
            // 检查是否是新的账户
            const currentKey = publicKey.value?.toBase58();
            const newKey = newPublicKey.toBase58();
            if (currentKey !== newKey) {
              publicKey.value = newPublicKey;
              walletAdapter.publicKey = newPublicKey;
              fetchBalance();
            }
          } else {
            // 账户被断开
            publicKey.value = null;
            connected.value = false;
            balance.value = 0;
          }
        }
      };

      const handlePhantomDisconnect = () => {
        if (walletAdapter === wallet.value) {
          publicKey.value = null;
          connected.value = false;
          balance.value = 0;
          wallet.value = null;
          cleanupWalletListeners();
        }
      };

      if (phantom.on) {
        phantom.on('accountChanged', handlePhantomAccountChange);
        phantom.on('disconnect', handlePhantomDisconnect);
        
        walletEventListeners.push(() => {
          if (phantom.off) {
            phantom.off('accountChanged', handlePhantomAccountChange);
            phantom.off('disconnect', handlePhantomDisconnect);
          }
        });
      }
    }

    // 方法2: 监听钱包适配器的事件（如果支持）
    if (typeof walletAdapter.on === 'function') {
      const handleAccountChange = (newPublicKey: PublicKey | null) => {
        if (walletAdapter === wallet.value) {
          if (newPublicKey) {
            publicKey.value = newPublicKey;
            connected.value = true;
            fetchBalance();
          } else {
            publicKey.value = null;
            connected.value = false;
            balance.value = 0;
          }
        }
      };

      const handleDisconnect = () => {
        if (walletAdapter === wallet.value) {
          publicKey.value = null;
          connected.value = false;
          balance.value = 0;
          wallet.value = null;
          cleanupWalletListeners();
        }
      };

      const handleConnect = (newPublicKey: PublicKey) => {
        if (walletAdapter === wallet.value) {
          publicKey.value = newPublicKey;
          connected.value = true;
          fetchBalance();
        }
      };

      walletAdapter.on('accountChanged', handleAccountChange);
      walletAdapter.on('disconnect', handleDisconnect);
      walletAdapter.on('connect', handleConnect);

      walletEventListeners.push(() => {
        if (walletAdapter && typeof walletAdapter.off === 'function') {
          walletAdapter.off('accountChanged', handleAccountChange);
          walletAdapter.off('disconnect', handleDisconnect);
          walletAdapter.off('connect', handleConnect);
        }
      });
    }

    // 方法3: 使用 watch 监听 walletAdapter.publicKey 的变化
    if (publicKeyWatchStop) {
      publicKeyWatchStop();
      publicKeyWatchStop = null;
    }

    publicKeyWatchStop = watch(
      () => walletAdapter.publicKey,
      (newPublicKey: PublicKey | null, oldPublicKey: PublicKey | null) => {
        if (walletAdapter === wallet.value && connected.value) {
          const newKey = newPublicKey?.toBase58();
          const oldKey = oldPublicKey?.toBase58();
          
          if (newKey !== oldKey) {
            if (newPublicKey) {
              publicKey.value = newPublicKey;
              fetchBalance();
            } else {
              publicKey.value = null;
              connected.value = false;
              balance.value = 0;
            }
          }
        }
      },
      { immediate: false }
    );

    walletEventListeners.push(() => {
      if (publicKeyWatchStop) {
        publicKeyWatchStop();
        publicKeyWatchStop = null;
      }
    });

    // 方法4: 轮询检查 publicKey 变化（作为备用方案）
    if (publicKeyPollInterval) {
      clearInterval(publicKeyPollInterval);
      publicKeyPollInterval = null;
    }

    publicKeyPollInterval = window.setInterval(() => {
      if (walletAdapter === wallet.value && connected.value) {
        const currentPublicKey = walletAdapter.publicKey;
        const storedPublicKey = publicKey.value;
        
        if (currentPublicKey) {
          const currentKey = currentPublicKey.toBase58();
          const storedKey = storedPublicKey?.toBase58();
          
          if (currentKey !== storedKey) {
            // 检测到账户变化
            publicKey.value = currentPublicKey;
            fetchBalance();
          }
        } else if (storedPublicKey) {
          // 钱包已断开
          publicKey.value = null;
          connected.value = false;
          balance.value = 0;
        }
      }
    }, 1000); // 每秒检查一次

    walletEventListeners.push(() => {
      if (publicKeyPollInterval) {
        clearInterval(publicKeyPollInterval);
        publicKeyPollInterval = null;
      }
    });
  };

  // 清理钱包事件监听器
  const cleanupWalletListeners = () => {
    walletEventListeners.forEach(cleanup => cleanup());
    walletEventListeners = [];
    
    if (publicKeyWatchStop) {
      publicKeyWatchStop();
      publicKeyWatchStop = null;
    }
    
    if (publicKeyPollInterval) {
      clearInterval(publicKeyPollInterval);
      publicKeyPollInterval = null;
    }
  };

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

      // 设置事件监听器
      setupWalletListeners(walletAdapter);

      // 获取余额
      await fetchBalance();

      return true;
    } catch (error) {
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
      // 清理事件监听器
      cleanupWalletListeners();
      
      await wallet.value.disconnect();
      wallet.value = null;
      publicKey.value = null;
      connected.value = false;
      balance.value = 0;
    } catch (error) {
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

  // 监听钱包状态变化，自动设置/清理事件监听器
  watch(
    () => wallet.value,
    (newWallet, oldWallet) => {
      if (newWallet && newWallet !== oldWallet) {
        // 钱包已连接，设置事件监听器
        setupWalletListeners(newWallet);
      } else if (!newWallet && oldWallet) {
        // 钱包已断开，清理事件监听器
        cleanupWalletListeners();
      }
    },
    { immediate: true }
  );

  // 组件卸载时清理事件监听器
  onUnmounted(() => {
    cleanupWalletListeners();
  });

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
