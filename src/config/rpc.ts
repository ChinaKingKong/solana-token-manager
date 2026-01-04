/**
 * Solana RPC 端点配置
 */

// RPC 端点配置
export const RPC_ENDPOINTS = {
  mainnet: 'https://solana-mainnet.g.alchemy.com/v2/aGpzH_QuHb5nBTL9KeE59crV6FAaO-p0',
  devnet: 'https://solana-devnet.g.alchemy.com/v2/aGpzH_QuHb5nBTL9KeE59crV6FAaO-p0',
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
