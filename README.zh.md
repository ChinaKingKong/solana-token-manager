**语言 / Language**: [中文](#) | [English](README.md)

# Solana 代币管理器

一个基于 Vue 3、TypeScript 和 Solana 区块链的代币管理系统，提供完整的 Solana SPL 代币管理功能。

![代币列表Demo](/src/assets/Demo1.jpg) 
![交易历史Demo](/src/assets/Demo6.jpg)

---

## 环境要求

### 环境配置要求

- **Node.js**: >= 18.0.0 (推荐: 18.x 或 20.x LTS 版本)
- **npm**: >= 9.0.0 (或 yarn >= 1.22.0)
- **浏览器**: 支持 ES6+ 的现代浏览器 (Chrome, Firefox, Edge, Safari)

### 推荐工具

- **Node 版本管理器**: 使用 [nvm](https://github.com/nvm-sh/nvm) 或 [fnm](https://github.com/Schniz/fnm) 管理 Node.js 版本
- **包管理器**: npm (随 Node.js 安装) 或 yarn

### 验证安装

检查您的 Node.js 和 npm 版本：

```bash
node --version  # 应该 >= 18.0.0
npm --version   # 应该 >= 9.0.0
```

## 功能特性

### 代币管理

- **代币列表**：查看您的 Solana 代币，包括 SOL 和 SPL 代币，支持实时余额刷新
  - 按创建时间倒序排列（最新创建的在前）
  - 代币数量显示 1 位小数
  - 保存的 Mint 地址下拉选择
  - 从代币列表快速转账
  - 每页显示 8 条记录
- **创建代币**：创建新的 Solana SPL 代币，可自定义名称、符号、小数位数和权限
  - 自动保存创建的 Mint 地址到本地存储
- **铸造代币**：向指定钱包地址铸造代币，支持自动创建关联账户
  - Mint 地址输入框支持已保存地址下拉选择
  - 支持下拉选择和手动输入两种方式
- **转账代币**：转账代币到其他地址，支持自动创建接收者关联账户
  - Mint 地址输入框支持已保存地址下拉选择
- **销毁代币**：销毁持有的代币，减少代币总供应量
  - Mint 地址输入框支持已保存地址下拉选择
- **冻结管理**：冻结和解冻代币账户，需要冻结权限
  - Mint 地址输入框支持已保存地址下拉选择
  - 根据钱包地址冻结（系统自动计算 ATA 地址）
  - 权限状态显示

### IPFS 和元数据

- **IPFS 上传**：上传文件和 JSON 元数据到 IPFS（使用 Pinata）
  - 支持文件上传和 JSON 内容上传
  - Pinata API 密钥配置
  - URL 更新和内容替换功能
- **设置 Metadata**：为代币设置和更新元数据
  - Mint 地址输入框支持已保存地址下拉选择
  - 支持创建和更新元数据
  - 自动保留现有元数据字段（sellerFeeBasisPoints、creators）

### 交易历史

- **交易记录**：查看钱包的所有交易历史记录
  - 成功加载时显示具体加载的交易数量
  - 分页显示，每页 10 条记录
  - 地址显示格式：前 8 位字符 + 5 个点 + 后 8 位字符
- **交易详情**：查看每笔交易的详细信息
  - 指令详情、账户余额变更、交易日志
  - 完整交易数据显示
- **统计分析**：显示总交易数、成功/失败交易统计

### 钱包功能

- **多钱包支持**：支持 Phantom 和 Coinbase 钱包
- **网络切换**：支持主网（Mainnet）和测试网（Devnet）切换
- **动态 RPC**：根据网络自动切换 RPC 端点
- **钱包切换检测**：自动检测钱包切换并刷新数据
- **国际化**：支持中文和英文双语

### SOL 水龙头（仅限测试网）

- **请求测试 SOL**：在测试网上请求 2 SOL 测试代币
  - 仅在测试网可用
  - 8 小时冷却期
  - 每个钱包地址独立记录（切换钱包时重置记录和倒计时）
  - 请求成功后自动刷新余额

## 技术栈

- **前端框架**：Vue 3 (Composition API + setup syntax sugar)
- **类型系统**：TypeScript
- **UI 组件库**：Ant Design Vue
- **样式框架**：Tailwind CSS
- **国际化**：Vue I18n
- **区块链**：
  - Solana Web3.js
  - Solana SPL Token
  - Solana Wallet Adapter
- **存储**：IPFS (via Pinata API)
- **构建工具**：Vite

## 项目结构

```
src/
├── components/          # 公共组件
│   ├── Header.vue      # 顶部导航栏
│   ├── Sidebar.vue     # 侧边栏菜单
│   ├── wallet.vue      # 钱包连接组件
│   └── MintAddressInput.vue  # 可复用的 Mint 地址输入组件
├── composables/         # 组合式函数
│   └── useTokenMints.ts  # 代币 Mint 地址管理（localStorage）
├── hooks/               # 自定义 Hooks
│   └── useWallet.ts    # 钱包管理 Hook
├── i18n/                # 国际化
│   ├── index.ts        # i18n 配置
│   └── locales/        # 语言文件
│       ├── zh.ts       # 中文
│       └── en.ts       # 英文
├── config/              # 配置文件
│   ├── rpc.ts          # RPC 端点配置
│   └── wallet.ts       # 钱包配置
├── providers/           # 提供者组件
│   └── WalletProvider.vue
├── views/               # 页面视图
│   ├── token/          # 代币相关页面
│   │   ├── list.vue    # 代币列表（按创建时间排序）
│   │   ├── create.vue  # 创建代币
│   │   ├── mint.vue    # 铸造代币
│   │   ├── transfer.vue # 转账代币
│   │   ├── burn.vue    # 销毁代币
│   │   └── freeze.vue  # 冻结管理
│   ├── ipfs/           # IPFS 相关
│   │   └── index.vue   # IPFS 上传
│   ├── metadata/       # 元数据相关
│   │   └── index.vue   # 设置 Metadata
│   ├── history/        # 交易历史
│   │   └── index.vue   # 交易历史记录
│   └── faucet/         # SOL 水龙头（仅限测试网）
│       └── index.vue   # 请求测试 SOL
├── utils/              # 工具函数
│   ├── ipfs.ts         # IPFS 上传工具
│   ├── metadata.ts     # Metaplex 元数据操作
│   ├── token.ts        # 代币操作工具
│   └── wallet.ts       # 钱包工具
└── App.vue             # 根组件
```

## 开发

### 前置要求

在开始之前，请确保您已满足所需的环境要求：

1. **安装 Node.js**（如果尚未安装）：
   - 访问 [Node.js 官方网站](https://nodejs.org/)
   - 下载并安装 Node.js 18.x 或 20.x LTS 版本
   - 或使用版本管理器：
     ```bash
     # 使用 nvm
     nvm install 18
     nvm use 18
     
     # 使用 fnm
     fnm install 18
     fnm use 18
     ```

2. **验证安装**：
   ```bash
   node --version  # 应该显示 v18.x.x 或 v20.x.x
   npm --version   # 应该显示 9.x.x 或更高版本
   ```

### 安装依赖

```bash
npm install
```

**注意**：如果遇到依赖安装问题，可以尝试：
```bash
# 清除 npm 缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json，然后重新安装
rm -rf node_modules package-lock.json
npm install
```

### 环境变量配置

项目使用环境变量来配置 Solana RPC 端点。请按照以下步骤配置：

1. 在项目根目录创建 `.env` 文件（如果不存在）
2. 添加以下环境变量：

```env
# Solana RPC 端点配置
VITE_SOLANA_MAINNET_RPC=https://solana-mainnet.g.alchemy.com/v2/your-api-key
VITE_SOLANA_DEVNET_RPC=https://solana-devnet.g.alchemy.com/v2/your-api-key
```

**获取 Alchemy API 密钥：**

1. 访问 [Alchemy Dashboard](https://dashboard.alchemy.com/)
2. 注册/登录账号
3. 创建新的 Solana 应用
4. 在应用详情页复制 HTTP API URL（包含 API 密钥）
5. 将 URL 替换到 `.env` 文件中的 `your-api-key` 部分

**注意：**

- 环境变量必须以 `VITE_` 开头才能在客户端代码中访问
- `.env` 文件已添加到 `.gitignore`，不会被提交到版本控制
- 修改 `.env` 文件后需要重启开发服务器才能生效

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 使用说明

### 连接钱包

1. 安装 Solana 钱包扩展（Phantom 或 Coinbase）
2. 点击右上角"连接钱包"按钮
3. 选择要连接的钱包并授权

### 网络切换

- 点击右上角的网络切换按钮
- 选择"主网"或"测试网"
- RPC 连接会自动更新（使用 `.env` 中配置的对应网络 RPC 端点）
- 如果未配置环境变量，将使用 Solana 的公共 RPC 端点（可能有速率限制）

### 语言切换

- 点击右上角的语言切换按钮（网络切换按钮旁边）
- 选择"中文"（Chinese）或"English"
- 界面语言将立即更改
- 语言偏好保存在 localStorage 中，下次访问时会记住

### 创建代币

1. 进入"创建代币"页面
2. 填写代币名称、符号和小数位数
3. 选择是否保留铸币权限和冻结权限
4. 点击"创建代币"按钮
5. 在钱包中确认交易

### 铸造代币

1. 进入"铸造代币"页面
2. 输入代币 Mint 地址
3. 输入铸造数量
4. 选择铸造目标（当前钱包或指定地址）
5. 点击"铸造代币"按钮

### 转账代币

1. 进入"转账代币"页面
2. 输入代币 Mint 地址
3. 输入接收地址和转账数量
4. 点击"转账代币"按钮

### 销毁代币

1. 进入"销毁代币"页面
2. 输入代币 Mint 地址
3. 输入销毁数量
4. 点击"销毁代币"按钮
5. 在钱包中确认交易

### 冻结管理

1. 进入"冻结管理"页面
2. 输入代币 Mint 地址
3. 输入目标钱包地址（系统会自动计算 ATA 地址）
4. 选择操作类型（冻结或解冻）
5. 点击操作按钮

**注意**：系统会根据钱包地址和 Mint 地址自动计算关联代币账户（ATA）地址，您只需输入钱包地址即可。

### IPFS 上传

1. 进入"IPFS上传"页面
2. 配置 Pinata API 密钥
3. 选择上传模式（文件或 JSON）
4. 上传内容到 IPFS
5. 复制生成的 IPFS 链接

### SOL 水龙头（仅限测试网）

1. 切换到测试网
2. 进入"SOL 水龙头"页面（仅在测试网显示）
3. 连接钱包
4. 点击"请求2 SOL"按钮
5. 等待交易确认
6. 每个钱包每 8 小时可请求一次

## 配置说明

### RPC 端点配置

项目支持通过环境变量配置 Solana RPC 端点，推荐使用 Alchemy 或其他 RPC 服务提供商：

- **优势**：更高的请求速率限制、更稳定的连接、更好的性能
- **配置**：在 `.env` 文件中设置 `VITE_SOLANA_MAINNET_RPC` 和 `VITE_SOLANA_DEVNET_RPC`
- **默认值**：如果未配置，将使用 Solana 的公共 RPC 端点（可能有速率限制，如 429 错误）

### Pinata IPFS 配置

IPFS 上传功能使用 Pinata 服务，需要在页面中配置认证凭证：

**推荐方式：使用 API Key + Secret**

- 访问 [Pinata App](https://app.pinata.cloud/) 注册/登录账号
- 在侧边栏选择 "API Keys"，点击右上角 "New Key"
- 建议选择 Admin 权限和无限使用次数
- 复制生成的 **API Key** 和 **Secret API Key**
- 在"IPFS上传"页面选择 "API Key + Secret（推荐）" 模式，输入 API Key 和 Secret Key

**备选方式：使用 JWT**

- 如果您的 Pinata 账号使用新版 JWT 认证，可以选择 "JWT" 模式
- 在"IPFS上传"页面输入 JWT 令牌

参考文档：[Pinata Quickstart](https://docs.pinata.cloud/quickstart)

## 注意事项

- **环境变量**：`.env` 文件包含敏感信息，已添加到 `.gitignore`，不会被提交到版本控制
- **RPC 配置**：建议配置 Alchemy 或其他 RPC 服务，避免使用公共端点时的速率限制问题
- **生产环境**：Pinata API 密钥应通过后端服务处理，避免暴露在前端
- **交易费用**：所有交易操作需要支付 Solana 网络手续费（SOL）
- **权限要求**：冻结/解冻操作需要代币的冻结权限
- **冻结管理**：冻结/解冻时输入钱包地址即可，无需输入 ATA 地址，系统会自动计算 ATA 地址
- **不可逆操作**：销毁代币是不可逆操作，请谨慎操作
- **测试建议**：建议在测试网上先测试功能，确认无误后再在主网操作
- **SOL 水龙头**：仅在测试网可用。每个钱包地址有独立的请求记录和冷却倒计时。切换钱包时，新钱包的请求记录和倒计时会重置
- **代币显示**：代币列表中的代币数量显示为 1 位小数，便于阅读

## 许可证

MIT

