# Solana Token Manager / Solana 代币管理器

A comprehensive Solana SPL token management system built with Vue 3, TypeScript, and Solana blockchain. / 一个基于 Vue 3、TypeScript 和 Solana 区块链的代币管理系统，提供完整的 Solana SPL 代币管理功能。

![Token List Demo / 代币列表Demo](/src/assets/Demo1.jpg) 
![Transaction History Demo / 交易历史Demo](/src/assets/Demo6.jpg)

---

## Features / 功能特性

### Token Management / 代币管理
- **Token List / 代币列表**：View your Solana tokens, including SOL and SPL tokens, with real-time balance refresh / 查看您的 Solana 代币，包括 SOL 和 SPL 代币，支持实时余额刷新
- **Create Token / 创建代币**：Create new Solana SPL tokens with customizable name, symbol, decimals, and permissions / 创建新的 Solana SPL 代币，可自定义名称、符号、小数位数和权限
- **Mint Token / 铸造代币**：Mint tokens to specified wallet addresses with automatic associated account creation / 向指定钱包地址铸造代币，支持自动创建关联账户
- **Transfer Token / 转账代币**：Transfer tokens to other addresses with automatic recipient account creation / 转账代币到其他地址，支持自动创建接收者关联账户
- **Burn Token / 销毁代币**：Burn held tokens to reduce total token supply / 销毁持有的代币，减少代币总供应量
- **Freeze Management / 冻结管理**：Freeze and thaw token accounts (requires freeze authority) / 冻结和解冻代币账户，需要冻结权限

### IPFS and Metadata / IPFS 和元数据
- **IPFS Upload / IPFS 上传**：Upload files and JSON metadata to IPFS (using Pinata) / 上传文件和 JSON 元数据到 IPFS（使用 Pinata）
- **Set Metadata / 设置 Metadata**：Set and update token metadata / 为代币设置和更新元数据

### Transaction History / 交易历史
- **Transaction Records / 交易记录**：View all transaction history for your wallet / 查看钱包的所有交易历史记录
- **Transaction Details / 交易详情**：View detailed information for each transaction / 查看每笔交易的详细信息
- **Statistics / 统计分析**：Display total transactions, success/failure statistics / 显示总交易数、成功/失败交易统计

### Wallet Features / 钱包功能
- **Multi-Wallet Support / 多钱包支持**：Support for Phantom and Coinbase wallets / 支持 Phantom 和 Coinbase 钱包
- **Network Switching / 网络切换**：Support for Mainnet and Devnet switching / 支持主网（Mainnet）和测试网（Devnet）切换
- **Dynamic RPC / 动态 RPC**：Automatic RPC endpoint switching based on network / 根据网络自动切换 RPC 端点
- **Internationalization / 国际化**：Support for Chinese and English languages / 支持中文和英文双语

## Tech Stack / 技术栈

- **Frontend Framework / 前端框架**：Vue 3 (Composition API + setup syntax sugar)
- **Type System / 类型系统**：TypeScript
- **UI Component Library / UI 组件库**：Ant Design Vue
- **Styling Framework / 样式框架**：Tailwind CSS
- **Internationalization / 国际化**：Vue I18n
- **Blockchain / 区块链**：
  - Solana Web3.js
  - Solana SPL Token
  - Solana Wallet Adapter
- **Storage / 存储**：IPFS (via Pinata API)
- **Build Tool / 构建工具**：Vite

## Project Structure / 项目结构

```
src/
├── components/          # Public Components / 公共组件
│   ├── Header.vue      # Top Navigation Bar / 顶部导航栏
│   ├── Sidebar.vue     # Sidebar Menu / 侧边栏菜单
│   └── wallet.vue       # Wallet Connection Component / 钱包连接组件
├── hooks/               # Custom Hooks / 自定义 Hooks
│   └── useWallet.ts    # Wallet Management Hook / 钱包管理 Hook
├── i18n/                # Internationalization / 国际化
│   ├── index.ts        # i18n Configuration / i18n 配置
│   └── locales/        # Language Files / 语言文件
│       ├── zh.ts       # Chinese / 中文
│       └── en.ts       # English / 英文
├── config/              # Configuration Files / 配置文件
│   └── rpc.ts          # RPC Endpoint Configuration / RPC 端点配置
├── providers/           # Provider Components / 提供者组件
│   └── WalletProvider.vue
├── views/               # Page Views / 页面视图
│   ├── token/          # Token Related Pages / 代币相关页面
│   │   ├── list.vue    # Token List / 代币列表
│   │   ├── create.vue  # Create Token / 创建代币
│   │   ├── mint.vue    # Mint Token / 铸造代币
│   │   ├── transfer.vue # Transfer Token / 转账代币
│   │   ├── burn.vue    # Burn Token / 销毁代币
│   │   └── freeze.vue  # Freeze Management / 冻结管理
│   ├── ipfs/           # IPFS Related / IPFS 相关
│   │   └── index.vue   # IPFS Upload / IPFS 上传
│   ├── metadata/       # Metadata Related / 元数据相关
│   │   └── index.vue   # Set Metadata / 设置 Metadata
│   └── history/        # Transaction History / 交易历史
│       └── index.vue   # Transaction History Records / 交易历史记录
├── utils/              # Utility Functions / 工具函数
│   ├── ipfs.ts         # IPFS Upload Utility / IPFS 上传工具
│   ├── token.ts        # Token Operations Utility / 代币操作工具
│   └── wallet.ts       # Wallet Utility / 钱包工具
└── App.vue             # Root Component / 根组件
```

## Development / 开发

### Install Dependencies / 安装依赖

```bash
npm install
```

### Environment Variables Configuration / 环境变量配置

The project uses environment variables to configure Solana RPC endpoints. Please follow these steps: / 项目使用环境变量来配置 Solana RPC 端点。请按照以下步骤配置：

1. Create a `.env` file in the project root directory (if it doesn't exist) / 在项目根目录创建 `.env` 文件（如果不存在）
2. Add the following environment variables: / 添加以下环境变量：

```env
# Solana RPC Endpoint Configuration / Solana RPC 端点配置
VITE_SOLANA_MAINNET_RPC=https://solana-mainnet.g.alchemy.com/v2/your-api-key
VITE_SOLANA_DEVNET_RPC=https://solana-devnet.g.alchemy.com/v2/your-api-key
```

**Get Alchemy API Key / 获取 Alchemy API 密钥：**
1. Visit [Alchemy Dashboard](https://dashboard.alchemy.com/) / 访问 Alchemy Dashboard
2. Register/Login / 注册/登录账号
3. Create a new Solana application / 创建新的 Solana 应用
4. Copy the HTTP API URL (including API key) from the application details page / 在应用详情页复制 HTTP API URL（包含 API 密钥）
5. Replace the URL in the `.env` file, replacing `your-api-key` / 将 URL 替换到 `.env` 文件中的 `your-api-key` 部分

**Note / 注意：**
- Environment variables must start with `VITE_` to be accessible in client code / 环境变量必须以 `VITE_` 开头才能在客户端代码中访问
- The `.env` file has been added to `.gitignore` and will not be committed to version control / `.env` 文件已添加到 `.gitignore`，不会被提交到版本控制
- After modifying the `.env` file, you need to restart the development server for changes to take effect / 修改 `.env` 文件后需要重启开发服务器才能生效

### Start Development Server / 启动开发服务器

```bash
npm run dev
```

### Build Production Version / 构建生产版本

```bash
npm run build
```

### Preview Production Build / 预览生产构建

```bash
npm run preview
```

## Usage Instructions / 使用说明

### Connect Wallet / 连接钱包

1. Install Solana wallet extension (Phantom or Coinbase) / 安装 Solana 钱包扩展（Phantom 或 Coinbase）
2. Click the "Connect Wallet" button in the top right corner / 点击右上角"连接钱包"按钮
3. Select and authorize the wallet to connect / 选择要连接的钱包并授权

### Network Switching / 网络切换

- Click the network switch button in the top right corner / 点击右上角的网络切换按钮
- Select "Mainnet" or "Devnet" / 选择"主网"或"测试网"
- RPC connection will automatically update (using the corresponding network RPC endpoint configured in `.env`) / RPC 连接会自动更新（使用 `.env` 中配置的对应网络 RPC 端点）
- If environment variables are not configured, Solana's public RPC endpoints will be used (may have rate limits) / 如果未配置环境变量，将使用 Solana 的公共 RPC 端点（可能有速率限制）

### Language Switching / 语言切换

- Click the language switch button in the top right corner (next to the network switch button) / 点击右上角的语言切换按钮（网络切换按钮旁边）
- Select "中文" (Chinese) or "English" / 选择"中文"或"English"
- The interface language will change immediately / 界面语言将立即更改
- Language preference is saved in localStorage and will be remembered on next visit / 语言偏好保存在 localStorage 中，下次访问时会记住

### Create Token / 创建代币

1. Go to the "Create Token" page / 进入"创建代币"页面
2. Fill in token name, symbol, and decimals / 填写代币名称、符号和小数位数
3. Choose whether to keep mint authority and freeze authority / 选择是否保留铸币权限和冻结权限
4. Click the "Create Token" button / 点击"创建代币"按钮
5. Confirm the transaction in your wallet / 在钱包中确认交易

### Mint Token / 铸造代币

1. Go to the "Mint Token" page / 进入"铸造代币"页面
2. Enter the token Mint address / 输入代币 Mint 地址
3. Enter the mint amount / 输入铸造数量
4. Select mint target (current wallet or specified address) / 选择铸造目标（当前钱包或指定地址）
5. Click the "Mint Token" button / 点击"铸造代币"按钮

### Transfer Token / 转账代币

1. Go to the "Transfer Token" page / 进入"转账代币"页面
2. Enter the token Mint address / 输入代币 Mint 地址
3. Enter recipient address and transfer amount / 输入接收地址和转账数量
4. Click the "Transfer Token" button / 点击"转账代币"按钮

### IPFS Upload / IPFS 上传

1. Go to the "IPFS Upload" page / 进入"IPFS上传"页面
2. Configure Pinata API key / 配置 Pinata API 密钥
3. Select upload mode (file or JSON) / 选择上传模式（文件或 JSON）
4. Upload content to IPFS / 上传内容到 IPFS
5. Copy the generated IPFS link / 复制生成的 IPFS 链接

## Configuration / 配置说明

### RPC Endpoint Configuration / RPC 端点配置

The project supports configuring Solana RPC endpoints through environment variables. It is recommended to use Alchemy or other RPC service providers: / 项目支持通过环境变量配置 Solana RPC 端点，推荐使用 Alchemy 或其他 RPC 服务提供商：

- **Advantages / 优势**：Higher request rate limits, more stable connections, better performance / 更高的请求速率限制、更稳定的连接、更好的性能
- **Configuration / 配置**：Set `VITE_SOLANA_MAINNET_RPC` and `VITE_SOLANA_DEVNET_RPC` in the `.env` file / 在 `.env` 文件中设置 `VITE_SOLANA_MAINNET_RPC` 和 `VITE_SOLANA_DEVNET_RPC`
- **Default / 默认值**：If not configured, Solana's public RPC endpoints will be used (may have rate limits, such as 429 errors) / 如果未配置，将使用 Solana 的公共 RPC 端点（可能有速率限制，如 429 错误）

### Pinata IPFS Configuration / Pinata IPFS 配置

The IPFS upload feature uses Pinata service and requires authentication credentials to be configured on the page: / IPFS 上传功能使用 Pinata 服务，需要在页面中配置认证凭证：

**Recommended Method: Use API Key + Secret / 推荐方式：使用 API Key + Secret**
- Visit [Pinata App](https://app.pinata.cloud/) to register/login / 访问 Pinata App 注册/登录账号
- Select "API Keys" in the sidebar, click "New Key" in the top right corner / 在侧边栏选择 "API Keys"，点击右上角 "New Key"
- It is recommended to select Admin permissions and unlimited usage / 建议选择 Admin 权限和无限使用次数
- Copy the generated **API Key** and **Secret API Key** / 复制生成的 **API Key** 和 **Secret API Key**
- On the "IPFS Upload" page, select "API Key + Secret (Recommended)" mode and enter the API Key and Secret Key / 在"IPFS上传"页面选择 "API Key + Secret（推荐）" 模式，输入 API Key 和 Secret Key

**Alternative Method: Use JWT / 备选方式：使用 JWT**
- If your Pinata account uses the new JWT authentication, you can select "JWT" mode / 如果您的 Pinata 账号使用新版 JWT 认证，可以选择 "JWT" 模式
- Enter the JWT token on the "IPFS Upload" page / 在"IPFS上传"页面输入 JWT 令牌

Reference Documentation: [Pinata Quickstart](https://docs.pinata.cloud/quickstart)

## Notes / 注意事项

- **Environment Variables / 环境变量**：The `.env` file contains sensitive information and has been added to `.gitignore`, so it will not be committed to version control / `.env` 文件包含敏感信息，已添加到 `.gitignore`，不会被提交到版本控制
- **RPC Configuration / RPC 配置**：It is recommended to configure Alchemy or other RPC services to avoid rate limit issues when using public endpoints / 建议配置 Alchemy 或其他 RPC 服务，避免使用公共端点时的速率限制问题
- **Production Environment / 生产环境**：Pinata API keys should be handled through backend services to avoid exposure in the frontend / Pinata API 密钥应通过后端服务处理，避免暴露在前端
- **Transaction Fees / 交易费用**：All transaction operations require payment of Solana network fees (SOL) / 所有交易操作需要支付 Solana 网络手续费（SOL）
- **Permission Requirements / 权限要求**：Freeze/thaw operations require freeze authority for the token / 冻结/解冻操作需要代币的冻结权限
- **Irreversible Operations / 不可逆操作**：Burning tokens is an irreversible operation, please operate with caution / 销毁代币是不可逆操作，请谨慎操作
- **Testing Recommendations / 测试建议**：It is recommended to test functions on the testnet first, and then operate on the mainnet after confirmation / 建议在测试网上先测试功能，确认无误后再在主网操作

## License / 许可证

MIT
