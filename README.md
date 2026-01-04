# Solana Token Manager

一个基于 Vue 3、TypeScript 和 Solana 区块链的代币管理系统，提供完整的 Solana SPL 代币管理功能。

![代币列表Demo](/src/assets/Demo1.jpg)![创建代币Demo](/src/assets/Demo2.jpg)
![铸造代币Demo](/src/assets/Demo3.jpg)![销毁代币Demo](/src/assets/Demo4.jpg)
![IPFS上传Demo](/src/assets/Demo5.jpg)![交易历史Demo](/src/assets/Demo6.jpg)

## 功能特性

### 代币管理
- **代币列表**：查看您的 Solana 代币，包括 SOL 和 SPL 代币，支持实时余额刷新
- **创建代币**：创建新的 Solana SPL 代币，可自定义名称、符号、小数位数和权限
- **铸造代币**：向指定钱包地址铸造代币，支持自动创建关联账户
- **转账代币**：转账代币到其他地址，支持自动创建接收者关联账户
- **销毁代币**：销毁持有的代币，减少代币总供应量
- **冻结管理**：冻结和解冻代币账户，需要冻结权限

### IPFS 和元数据
- **IPFS 上传**：上传文件和 JSON 元数据到 IPFS（使用 Pinata）
- **设置 Metadata**：为代币设置和更新元数据

### 交易历史
- **交易记录**：查看钱包的所有交易历史记录
- **交易详情**：查看每笔交易的详细信息
- **统计分析**：显示总交易数、成功/失败交易统计

### 钱包功能
- **多钱包支持**：支持 Phantom 和 Coinbase 钱包
- **网络切换**：支持主网（Mainnet）和测试网（Devnet）切换
- **动态 RPC**：根据网络自动切换 RPC 端点

## 技术栈

- **前端框架**：Vue 3 (Composition API + setup 语法糖)
- **类型系统**：TypeScript
- **UI 组件库**：Ant Design Vue
- **样式框架**：Tailwind CSS
- **区块链**：
  - Solana Web3.js
  - Solana SPL Token
  - Solana Wallet Adapter
- **存储**：IPFS (通过 Pinata API)
- **构建工具**：Vite

## 项目结构

```
src/
├── components/          # 公共组件
│   ├── Header.vue      # 顶部导航栏
│   ├── Sidebar.vue     # 侧边栏菜单
│   └── wallet.vue       # 钱包连接组件
├── hooks/               # 自定义 Hooks
│   └── useWallet.ts    # 钱包管理 Hook
├── providers/           # 提供者组件
│   └── WalletProvider.vue
├── views/               # 页面视图
│   ├── token/          # 代币相关页面
│   │   ├── list.vue    # 代币列表
│   │   ├── create.vue  # 创建代币
│   │   ├── mint.vue    # 铸造代币
│   │   ├── transfer.vue # 转账代币
│   │   ├── burn.vue    # 销毁代币
│   │   └── freeze.vue  # 冻结管理
│   ├── ipfs/           # IPFS 相关
│   │   └── index.vue   # IPFS 上传
│   ├── metadata/       # 元数据相关
│   │   └── index.vue   # 设置 Metadata
│   └── history/        # 交易历史
│       └── index.vue   # 交易历史记录
├── utils/              # 工具函数
│   ├── ipfs.ts         # IPFS 上传工具
│   ├── token.ts        # 代币操作工具
│   └── wallet.ts       # 钱包工具
└── App.vue             # 根组件
```

## 开发

### 安装依赖

```bash
npm install
```

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
- RPC 连接会自动更新

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

### IPFS 上传

1. 进入"IPFS上传"页面
2. 配置 Pinata API 密钥
3. 选择上传模式（文件或 JSON）
4. 上传内容到 IPFS
5. 复制生成的 IPFS 链接

## 注意事项

- 生产环境中，Pinata API 密钥应通过后端服务处理，避免暴露在前端
- 所有交易操作需要支付 Solana 网络手续费（SOL）
- 冻结/解冻操作需要代币的冻结权限
- 销毁代币是不可逆操作，请谨慎操作
- 建议在测试网上先测试功能

## 许可证

MIT
