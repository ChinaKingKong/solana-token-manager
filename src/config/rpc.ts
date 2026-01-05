/**
 * Solana RPC 端点配置
 */

// 网络类型
export type NetworkType = 'mainnet' | 'devnet';

// 默认网络
export const DEFAULT_NETWORK: NetworkType = 'devnet';

/**
 * 获取指定网络的RPC端点（每次调用时从环境变量读取，确保获取最新值）
 * @param network 网络类型
 * @returns RPC端点URL
 */
export function getRpcEndpoint(network: NetworkType = DEFAULT_NETWORK): string {
  // 从环境变量读取（每次调用时读取，确保获取最新值）
  const mainnetRpc = import.meta.env.VITE_SOLANA_MAINNET_RPC;
  const devnetRpc = import.meta.env.VITE_SOLANA_DEVNET_RPC;

  let endpoint: string;

  if (network === 'mainnet') {
    // 检查环境变量是否存在
    if (mainnetRpc && typeof mainnetRpc === 'string' && mainnetRpc.trim() !== '') {
      endpoint = mainnetRpc.trim();
    } else { 
      endpoint = 'https://api.mainnet-beta.solana.com';
    }
  } else {
    // devnet
    if (devnetRpc && typeof devnetRpc === 'string' && devnetRpc.trim() !== '') {
      endpoint = devnetRpc.trim();
    } else {
      endpoint = 'https://api.devnet.solana.com';
    }
  }

  return endpoint;
}

// RPC 端点配置（用于类型定义，实际值通过 getRpcEndpoint 函数获取）
export const RPC_ENDPOINTS = {
  mainnet: getRpcEndpoint('mainnet'),
  devnet: getRpcEndpoint('devnet'),
} as const;
