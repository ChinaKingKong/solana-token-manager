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
export const WALLET_KEY = Symbol('wallet');

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
  checkWalletConnection?: () => Promise<boolean>; // 可选，供外部调用
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

  // 支持的钱包类型
  // 注意：钱包适配器在需要时动态创建，而不是使用静态实例
  // 这样可以避免页面刷新后适配器实例与 window.solana 不同步的问题
  const createWalletAdapter = (walletName: string) => {
    switch (walletName) {
      case 'Phantom':
        return new PhantomWalletAdapter();
      case 'Coinbase':
        return new CoinbaseWalletAdapter();
      default:
        return null;
    }
  };

  // 创建 Phantom 的直接包装对象（用于重连场景）
  // 直接使用 window.solana，避免适配器实例的同步问题
  const createPhantomDirectAdapter = () => {
    const phantom = (window as any).solana;
    if (!phantom) return null;

    // 从 supportedWallets 中获取 Phantom 的 icon（确保使用正确的 URL）
    const phantomAdapter = supportedWallets.find((w: any) => w.name === 'Phantom');
    const phantomIcon = phantomAdapter?.icon || 'https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/phantom.svg';

    return {
      name: 'Phantom',
      url: 'https://phantom.app',
      icon: phantomIcon,

      // 直接使用 window.solana 的方法
      sendTransaction: async (transaction: any, connection: any) => {
        return await phantom.sendTransaction(transaction, connection);
      },

      signTransaction: async (transaction: any) => {
        return await phantom.signTransaction(transaction);
      },

      signAllTransactions: async (transactions: any[]) => {
        return await phantom.signAllTransactions(transactions);
      },

      connect: async () => {
        return await phantom.connect();
      },

      disconnect: async () => {
        return await phantom.disconnect();
      },

      // 只读属性
      get publicKey() {
        return phantom.publicKey;
      },

      get connected() {
        return phantom.isConnected;
      },

      get readyState() {
        return phantom.readyState || 'Installed';
      },

      // 事件监听
      on: (event: string, callback: any) => {
        if (phantom.on) {
          return phantom.on(event, callback);
        }
      },

      off: (event: string, callback: any) => {
        if (phantom.off) {
          return phantom.off(event, callback);
        }
      }
    };
  };

  // 获取所有支持的钱包适配器（用于显示可用钱包列表）
  const getSupportedWallets = () => [
    new PhantomWalletAdapter(),
    new CoinbaseWalletAdapter(),
  ];

  const supportedWallets = getSupportedWallets();

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
        // 只有在钱包已连接且确实是当前钱包时才响应
        if (connected.value && walletAdapter === wallet.value && publicKey.value) {
          if (newPublicKey) {
            // 检查是否是新的账户
            const currentKey = publicKey.value?.toBase58();
            const newKey = newPublicKey.toBase58();
            if (currentKey !== newKey) {
              publicKey.value = newPublicKey;
              // 注意：walletAdapter.publicKey 是只读的，不能直接设置
              fetchBalance();
            }
          } else {
            // 账户被断开（只有在之前有 publicKey 时才认为是断开）
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
        // 只有在钱包已连接且确实是当前钱包时才响应
        if (walletAdapter === wallet.value && connected.value && publicKey.value) {
          if (newPublicKey) {
            const currentKey = publicKey.value?.toBase58();
            const newKey = newPublicKey.toBase58();
            if (currentKey !== newKey) {
              publicKey.value = newPublicKey;
              fetchBalance();
            }
          } else {
            // 只有在之前有 publicKey 时才认为是断开
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
        // 只有在钱包已连接且确实是当前钱包时才响应
        if (walletAdapter === wallet.value && connected.value && publicKey.value) {
          const newKey = newPublicKey?.toBase58();
          const oldKey = oldPublicKey?.toBase58();
          const currentKey = publicKey.value?.toBase58();

          // 只有当 publicKey 确实发生变化时才更新
          if (newKey !== oldKey && newKey !== currentKey) {
            if (newPublicKey) {
              // 账户切换
              publicKey.value = newPublicKey;
              fetchBalance();
            } else if (oldPublicKey && !newPublicKey) {
              // 只有在之前有 publicKey 但现在没有时才断开
              // 这表示钱包确实断开了，而不是初始化时的 null
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
      // 只有在钱包已连接且确实是当前钱包时才检查
      if (walletAdapter === wallet.value && connected.value && publicKey.value) {
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
          // 钱包已断开（只有在之前有 publicKey 时才认为是断开）
          // 对于 Phantom，还需要检查 window.solana（同时检查 isConnected 和 publicKey）
          if (walletAdapter.name === 'Phantom') {
            const phantom = (window as any).solana;
            if (phantom) {
              try {
                const isConnected = phantom.isConnected === true;
                const hasPublicKey = phantom.publicKey !== null && phantom.publicKey !== undefined;
                
                if (isConnected && hasPublicKey) {
                  // Phantom 仍然连接，只是适配器的 publicKey 可能还没更新
                  return;
                }
              } catch (error) {
                // 检查失败，继续断开逻辑
              }
            }
          }
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

      // 清除手动断开标志（用户主动连接，允许自动连接）
      localStorage.removeItem('solana-wallet-manually-disconnected');

      // 保存连接的钱包名称到 localStorage
      if (walletAdapter.name) {
        localStorage.setItem('solana-wallet-name', walletAdapter.name);
      }

      // 保存连接时间戳（用于2小时后过期检查）
      localStorage.setItem('solana-wallet-connect-time', Date.now().toString());

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

  // 检查钱包连接是否过期（超过2小时需要重新连接）
  const isWalletConnectionExpired = () => {
    const connectTime = localStorage.getItem('solana-wallet-connect-time');
    if (!connectTime) {
      // 如果没有保存连接时间，认为已过期（旧版本兼容）
      return true;
    }

    const currentTime = Date.now();
    const timeDiff = currentTime - parseInt(connectTime);
    const twoHoursInMs = 2 * 60 * 60 * 1000; // 2小时的毫秒数

    return timeDiff > twoHoursInMs;
  };

  // 清除过期的连接信息
  const clearExpiredConnection = () => {
    localStorage.removeItem('solana-wallet-name');
    localStorage.removeItem('solana-wallet-connect-time');
  };

  // 检查钱包适配器是否已经连接
  const checkWalletConnection = async () => {
    // 如果用户手动断开过，不再自动连接
    if (localStorage.getItem('solana-wallet-manually-disconnected') === 'true') {
      return false;
    }

    // 检查连接是否已过期（超过2小时）
    if (isWalletConnectionExpired()) {
      // 清除过期的连接信息
      clearExpiredConnection();
      return false;
    }

    // 对于 Phantom，检查 window.solana（优先检查，因为这是最常见的重连场景）
    const phantom = (window as any).solana;
    if (phantom) {
      try {
        const isConnected = phantom.isConnected === true;
        const hasPublicKey = phantom.publicKey !== null && phantom.publicKey !== undefined;

        if (isConnected && hasPublicKey) {
          // Phantom 已经连接，使用直接包装对象（避免适配器实例同步问题）
          const directAdapter = createPhantomDirectAdapter();
          if (directAdapter) {
            // 先设置状态，再设置事件监听器，避免监听器误触发
            wallet.value = directAdapter;
            publicKey.value = phantom.publicKey;
            connected.value = true;

            // 等待一小段时间，确保状态已设置
            await new Promise(resolve => setTimeout(resolve, 50));

            // 设置事件监听器
            setupWalletListeners(directAdapter);

            // 获取余额
            await fetchBalance();

            // 保存钱包名称和更新连接时间戳
            localStorage.setItem('solana-wallet-name', 'Phantom');
            localStorage.setItem('solana-wallet-connect-time', Date.now().toString());

            return true;
          }
        }
      } catch (error) {
        // 静默处理错误
      }
    }

    // 检查其他钱包适配器是否已经有 publicKey（表示已连接）
    for (const walletAdapter of supportedWallets) {
      // 跳过 Phantom，因为上面已经检查过了
      if (walletAdapter.name === 'Phantom') {
        continue;
      }

      // 检查钱包适配器是否已经有 publicKey
      if (walletAdapter.publicKey) {
        // 先设置状态，再设置事件监听器，避免监听器误触发
        wallet.value = walletAdapter;
        publicKey.value = walletAdapter.publicKey;
        connected.value = true;

        // 等待一小段时间，确保状态已设置
        await new Promise(resolve => setTimeout(resolve, 50));

        // 设置事件监听器
        setupWalletListeners(walletAdapter);

        // 获取余额
        await fetchBalance();

        // 保存钱包名称和更新连接时间戳
        if (walletAdapter.name) {
          localStorage.setItem('solana-wallet-name', walletAdapter.name);
          localStorage.setItem('solana-wallet-connect-time', Date.now().toString());
        }

        return true;
      }
    }

    return false;
  };

  // 自动连接（优先连接上次使用的钱包）
  const autoConnect = async () => {
    // 如果用户手动断开过，不再自动连接
    if (localStorage.getItem('solana-wallet-manually-disconnected') === 'true') {
      return false;
    }

    // 检查连接是否已过期（超过2小时）
    if (isWalletConnectionExpired()) {
      // 清除过期的连接信息
      clearExpiredConnection();
      return false;
    }

    // 首先检查钱包适配器是否已经连接
    if (await checkWalletConnection()) {
      return true;
    }
    
    // 等待一小段时间，让钱包适配器完全初始化
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 再次检查
    if (await checkWalletConnection()) {
      return true;
    }
    
    // 获取上次使用的钱包名称
    const savedWalletName = localStorage.getItem('solana-wallet-name');

    if (savedWalletName) {
      // 对于 Phantom，检查 window.solana（这是最常见的重连场景）
      if (savedWalletName === 'Phantom') {
        const phantom = (window as any).solana;
        if (phantom) {
          try {
            const isConnected = phantom.isConnected === true;
            const hasPublicKey = phantom.publicKey !== null && phantom.publicKey !== undefined;

            if (isConnected && hasPublicKey) {
              // Phantom 已经连接，使用直接包装对象
              const directAdapter = createPhantomDirectAdapter();
              if (directAdapter) {
                // 先设置状态，再设置事件监听器，避免监听器误触发
                wallet.value = directAdapter;
                publicKey.value = phantom.publicKey;
                connected.value = true;

                // 等待一小段时间，确保状态已设置
                await new Promise(resolve => setTimeout(resolve, 50));

                // 设置事件监听器
                setupWalletListeners(directAdapter);

                // 获取余额
                await fetchBalance();

                // 更新连接时间戳
                localStorage.setItem('solana-wallet-connect-time', Date.now().toString());

                return true;
              }
            }
          } catch (error) {
            // 静默处理错误
          }
        } else {
          // Phantom 未检测到，清除保存的状态
          clearExpiredConnection();
          return false;
        }
      }

      // 对于其他钱包或 Phantom 未连接的情况，尝试连接
      const savedWallet = supportedWallets.find(w => w.name === savedWalletName);
      if (savedWallet) {
        try {
          // 检查钱包是否可用（已安装）
          if (savedWallet.readyState === 'Installed' || savedWallet.readyState === 'Loadable') {
            // 尝试使用钱包适配器的 autoConnect 方法（如果存在）
            if (typeof savedWallet.autoConnect === 'function') {
              try {
                await savedWallet.autoConnect();
                if (savedWallet.publicKey) {
                  // 先设置状态，再设置事件监听器，避免监听器误触发
                  wallet.value = savedWallet;
                  publicKey.value = savedWallet.publicKey;
                  connected.value = true;

                  // 等待一小段时间，确保状态已设置
                  await new Promise(resolve => setTimeout(resolve, 50));

                  // 设置事件监听器
                  setupWalletListeners(savedWallet);

                  // 获取余额
                  await fetchBalance();

                  return true;
                }
              } catch (error) {
                // autoConnect 失败，尝试手动连接
              }
            }

            // 如果 autoConnect 不可用或失败，尝试手动连接
            // 注意：这可能需要用户授权，所以可能会失败
            try {
              const result = await connectWallet(savedWallet);
              if (result) return true;
            } catch (error) {
              // 手动连接失败（可能需要用户授权），不清除保存的状态
              // 这样用户下次刷新页面时仍然会尝试连接
            }
          } else {
            // 钱包未安装，清除保存的状态
            localStorage.removeItem('solana-wallet-name');
          }
        } catch (error) {
          // 连接失败，但不清除保存的状态（可能是用户未授权）
        }
      } else {
        // 找不到保存的钱包，清除状态
        localStorage.removeItem('solana-wallet-name');
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

      // 记录这是用户手动断开的，刷新页面时不再自动连接
      localStorage.setItem('solana-wallet-manually-disconnected', 'true');
      // 清除保存的钱包名称和连接时间戳
      localStorage.removeItem('solana-wallet-name');
      localStorage.removeItem('solana-wallet-connect-time');
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
      // 如果是403错误，可能是RPC端点速率限制，静默处理
      // 用户可以通过配置自己的RPC端点来解决
    }
  };

  // 发送交易
  const sendTransaction = async (transaction: any) => {
    if (!wallet.value) {
      // Fallback: 如果 wallet.value 为空，尝试直接使用 window.solana
      const phantom = (window as any).solana;
      if (phantom && phantom.isConnected && phantom.publicKey && phantom.sendTransaction) {
        try {
          const signature = await phantom.sendTransaction(transaction, connection.value);
          await connection.value.confirmTransaction(signature);
          return signature;
        } catch (error) {
          throw error;
        }
      }

      throw new Error('钱包未连接');
    }

    try {
      const signature = await wallet.value.sendTransaction(transaction, connection.value);
      await connection.value.confirmTransaction(signature);
      return signature;
    } catch (error) {
      // Fallback: 如果适配器的 sendTransaction 失败，尝试直接使用 window.solana
      if (wallet.value?.name === 'Phantom') {
        const phantom = (window as any).solana;
        if (phantom && phantom.isConnected && phantom.publicKey && phantom.sendTransaction) {
          try {
            const signature = await phantom.sendTransaction(transaction, connection.value);
            await connection.value.confirmTransaction(signature);
            return signature;
          } catch (fallbackError) {
            throw error; // 抛出原始错误
          }
        }
      }

      throw error;
    }
  };

  // 签名交易
  const signTransaction = async (transaction: any) => {
    if (!wallet.value) {
      // Fallback: 如果 wallet.value 为空，尝试直接使用 window.solana
      const phantom = (window as any).solana;
      if (phantom && phantom.isConnected && phantom.publicKey && phantom.signTransaction) {
        try {
          return await phantom.signTransaction(transaction);
        } catch (error) {
          throw error;
        }
      }
      throw new Error('钱包未连接');
    }

    try {
      return await wallet.value.signTransaction(transaction);
    } catch (error) {
      // Fallback: 如果适配器的 signTransaction 失败，尝试直接使用 window.solana
      if (wallet.value?.name === 'Phantom') {
        const phantom = (window as any).solana;
        if (phantom && phantom.isConnected && phantom.publicKey && phantom.signTransaction) {
          try {
            return await phantom.signTransaction(transaction);
          } catch (fallbackError) {
            throw error; // 抛出原始错误
          }
        }
      }
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
  
  // 初始化完成后，立即检查钱包连接状态（作为备用方案）
  // 使用 setTimeout 确保所有函数都已定义，并且钱包适配器已初始化
  // 注意：这会在 WalletProvider.vue 的 onMounted 之前执行，作为快速检查
  if (typeof window !== 'undefined') {
    // 延迟检查（300ms 后，等待钱包适配器完全初始化）
    setTimeout(async () => {
      try {
        const connected = await checkWalletConnection();
        if (connected) return;
      } catch (error) {
        // 静默处理错误
      }
    }, 300);
    
    // 最后尝试自动连接（800ms 后，在 WalletProvider.vue 的 onMounted 之后）
    setTimeout(async () => {
      try {
        // 如果用户手动断开过，不再自动连接
        if (localStorage.getItem('solana-wallet-manually-disconnected') === 'true') {
          return;
        }
        await autoConnect();
      } catch (error) {
        // 静默处理错误
      }
    }, 800);
  }

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
    checkWalletConnection, // 暴露 checkWalletConnection 供外部调用
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
