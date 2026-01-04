import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { Connection, clusterApiUrl } from '@solana/web3.js';

// 网络配置
export const network = WalletAdapterNetwork.Devnet;
export const endpoint = clusterApiUrl(network);
export const connection = new Connection(endpoint, 'confirmed');

// 代币列表URL
export const TOKEN_LIST_URL = 'https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json';
