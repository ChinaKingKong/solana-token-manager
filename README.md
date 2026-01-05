**Language / 语言**: [English](#) | [中文](README.zh.md)

# Solana Token Manager

A comprehensive Solana SPL token management system built with Vue 3, TypeScript, and Solana blockchain.

![Token List Demo](/src/assets/Demo1_en.jpg) 
![Transaction History Demo](/src/assets/Demo2_en.jpg)
![Transaction History Demo](/src/assets/Demo3_en.jpg)

---

## Features

### Token Management

- **Token List**：View your Solana tokens, including SOL and SPL tokens, with real-time balance refresh
- **Create Token**：Create new Solana SPL tokens with customizable name, symbol, decimals, and permissions
- **Mint Token**：Mint tokens to specified wallet addresses with automatic associated account creation
- **Transfer Token**：Transfer tokens to other addresses with automatic recipient account creation
- **Burn Token**：Burn held tokens to reduce total token supply
- **Freeze Management**：Freeze and thaw token accounts (requires freeze authority)

### IPFS and Metadata

- **IPFS Upload**：Upload files and JSON metadata to IPFS (using Pinata)
- **Set Metadata**：Set and update token metadata

### Transaction History

- **Transaction Records**：View all transaction history for your wallet
- **Transaction Details**：View detailed information for each transaction
- **Statistics**：Display total transactions, success/failure statistics

### Wallet Features

- **Multi-Wallet Support**：Support for Phantom and Coinbase wallets
- **Network Switching**：Support for Mainnet and Devnet switching
- **Dynamic RPC**：Automatic RPC endpoint switching based on network
- **Internationalization**：Support for Chinese and English languages

## Tech Stack

- **Frontend Framework**：Vue 3 (Composition API + setup syntax sugar)
- **Type System**：TypeScript
- **UI Component Library**：Ant Design Vue
- **Styling Framework**：Tailwind CSS
- **Internationalization**：Vue I18n
- **Blockchain**：
  - Solana Web3.js
  - Solana SPL Token
  - Solana Wallet Adapter
- **Storage**：IPFS (via Pinata API)
- **Build Tool**：Vite

## Project Structure

```
src/
├── components/          # Public Components
│   ├── Header.vue      # Top Navigation Bar
│   ├── Sidebar.vue     # Sidebar Menu
│   └── wallet.vue       # Wallet Connection Component
├── hooks/               # Custom Hooks
│   └── useWallet.ts    # Wallet Management Hook
├── i18n/                # Internationalization
│   ├── index.ts        # i18n Configuration
│   └── locales/        # Language Files
│       ├── zh.ts       # Chinese
│       └── en.ts       # English
├── config/              # Configuration Files
│   └── rpc.ts          # RPC Endpoint Configuration
├── providers/           # Provider Components
│   └── WalletProvider.vue
├── views/               # Page Views
│   ├── token/          # Token Related Pages
│   │   ├── list.vue    # Token List
│   │   ├── create.vue  # Create Token
│   │   ├── mint.vue    # Mint Token
│   │   ├── transfer.vue # Transfer Token
│   │   ├── burn.vue    # Burn Token
│   │   └── freeze.vue  # Freeze Management
│   ├── ipfs/           # IPFS Related
│   │   └── index.vue   # IPFS Upload
│   ├── metadata/       # Metadata Related
│   │   └── index.vue   # Set Metadata
│   └── history/        # Transaction History
│       └── index.vue   # Transaction History Records
├── utils/              # Utility Functions
│   ├── ipfs.ts         # IPFS Upload Utility
│   ├── token.ts        # Token Operations Utility
│   └── wallet.ts       # Wallet Utility
└── App.vue             # Root Component
```

## Development

### Install Dependencies

```bash
npm install
```

### Environment Variables Configuration

The project uses environment variables to configure Solana RPC endpoints. Please follow these steps:

1. Create a `.env` file in the project root directory (if it doesn't exist)
2. Add the following environment variables:

```env
# Solana RPC Endpoint Configuration
VITE_SOLANA_MAINNET_RPC=https://solana-mainnet.g.alchemy.com/v2/your-api-key
VITE_SOLANA_DEVNET_RPC=https://solana-devnet.g.alchemy.com/v2/your-api-key
```

**Get Alchemy API Key：**

1. Visit [Alchemy Dashboard](https://dashboard.alchemy.com/)
2. Register/Login
3. Create a new Solana application
4. Copy the HTTP API URL (including API key) from the application details page
5. Replace the URL in the `.env` file, replacing `your-api-key`

**Note：**

- Environment variables must start with `VITE_` to be accessible in client code
- The `.env` file has been added to `.gitignore` and will not be committed to version control
- After modifying the `.env` file, you need to restart the development server for changes to take effect

### Start Development Server

```bash
npm run dev
```

### Build Production Version

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Usage Instructions

### Connect Wallet

1. Install Solana wallet extension (Phantom or Coinbase)
2. Click the "Connect Wallet" button in the top right corner
3. Select and authorize the wallet to connect

### Network Switching

- Click the network switch button in the top right corner
- Select "Mainnet" or "Devnet"
- RPC connection will automatically update (using the corresponding network RPC endpoint configured in `.env`)
- If environment variables are not configured, Solana's public RPC endpoints will be used (may have rate limits)

### Language Switching

- Click the language switch button in the top right corner (next to the network switch button)
- Select "中文" (Chinese) or "English"
- The interface language will change immediately
- Language preference is saved in localStorage and will be remembered on next visit

### Create Token

1. Go to the "Create Token" page
2. Fill in token name, symbol, and decimals
3. Choose whether to keep mint authority and freeze authority
4. Click the "Create Token" button
5. Confirm the transaction in your wallet

### Mint Token

1. Go to the "Mint Token" page
2. Enter the token Mint address
3. Enter the mint amount
4. Select mint target (current wallet or specified address)
5. Click the "Mint Token" button

### Transfer Token

1. Go to the "Transfer Token" page
2. Enter the token Mint address
3. Enter recipient address and transfer amount
4. Click the "Transfer Token" button

### IPFS Upload

1. Go to the "IPFS Upload" page
2. Configure Pinata API key
3. Select upload mode (file or JSON)
4. Upload content to IPFS
5. Copy the generated IPFS link

## Configuration

### RPC Endpoint Configuration

The project supports configuring Solana RPC endpoints through environment variables. It is recommended to use Alchemy or other RPC service providers:

- **Advantages**：Higher request rate limits, more stable connections, better performance
- **Configuration**：Set `VITE_SOLANA_MAINNET_RPC` and `VITE_SOLANA_DEVNET_RPC` in the `.env` file
- **Default**：If not configured, Solana's public RPC endpoints will be used (may have rate limits, such as 429 errors)

### Pinata IPFS Configuration

The IPFS upload feature uses Pinata service and requires authentication credentials to be configured on the page:

**Recommended Method: Use API Key + Secret**

- Visit [Pinata App](https://app.pinata.cloud/) to register/login
- Select "API Keys" in the sidebar, click "New Key" in the top right corner
- It is recommended to select Admin permissions and unlimited usage
- Copy the generated **API Key** and **Secret API Key**
- On the "IPFS Upload" page, select "API Key + Secret (Recommended)" mode and enter the API Key and Secret Key

**Alternative Method: Use JWT**

- If your Pinata account uses the new JWT authentication, you can select "JWT" mode
- Enter the JWT token on the "IPFS Upload" page

Reference Documentation: [Pinata Quickstart](https://docs.pinata.cloud/quickstart)

## Notes

- **Environment Variables**：The `.env` file contains sensitive information and has been added to `.gitignore`, so it will not be committed to version control
- **RPC Configuration**：It is recommended to configure Alchemy or other RPC services to avoid rate limit issues when using public endpoints
- **Production Environment**：Pinata API keys should be handled through backend services to avoid exposure in the frontend
- **Transaction Fees**：All transaction operations require payment of Solana network fees (SOL)
- **Permission Requirements**：Freeze/thaw operations require freeze authority for the token
- **Irreversible Operations**：Burning tokens is an irreversible operation, please operate with caution
- **Testing Recommendations**：It is recommended to test functions on the testnet first, and then operate on the mainnet after confirmation

## License

MIT
