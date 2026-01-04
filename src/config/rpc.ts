/**
 * Solana RPC 端点配置
 */

// RPC 端点配置（从环境变量读取）
export const RPC_ENDPOINTS = {
  mainnet: import.meta.env.VITE_SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com',
  devnet: import.meta.env.VITE_SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com',
} as const;

// 网络类型
export type NetworkType = keyof typeof RPC_ENDPOINTS;

// 默认网络
export const DEFAULT_NETWORK: NetworkType = 'mainnet';

/**
 * 获取指定网络的RPC端点
 * @param network 网络类型
 * @returns RPC端点URL
 */
export function getRpcEndpoint(network: NetworkType = DEFAULT_NETWORK): string {
  return RPC_ENDPOINTS[network];
}
