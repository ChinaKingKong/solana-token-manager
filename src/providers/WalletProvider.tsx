import { useMemo } from 'react';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { ConnectionProvider, WalletProvider as ReactWalletProvider } from '@solana/wallet-adapter-react';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TrustWalletAdapter,
  BitgetWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { network, connection, endpoint, TOKEN_LIST_URL } from '../config/wallet';
import { FC, ReactNode } from 'react';

// 需要默认导入样式
import '@solana/wallet-adapter-react-ui/styles.css';

// 钱包列表
const wallets = useMemo(
  () => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new CoinbaseWalletAdapter(),
    new TrustWalletAdapter(),
    new BitgetWalletAdapter(),
  ],
  [network]
);

// Context 组件
export const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <ReactWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </ReactWalletProvider>
    </ConnectionProvider>
  );
};
