# 🚀 Vercel 部署指南

## 📌 重要：Tag 部署模式

当前项目配置为**只在打 Tag 时才部署到生产环境**，而不是每次提交都自动部署。

### 工作流程

```bash
# 日常开发 - 提交代码（不会触发部署）
git add .
git commit -m "feat: 添加新功能"
git push origin main

# 准备发布 - 创建 Tag（触发部署）
git tag v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### 配置说明

`vercel.json` 中的配置：

```json
{
  "git": {
    "deploymentEnabled": {
      "main": false
    }
  }
}
```

- ❌ 普通 `git push` 不会触发部署
- ✅ 只有推送 Tag 时才部署

### Tag 命名规范

推荐使用语义化版本：
- `v1.0.0` - 正式版本
- `v1.0.1` - 补丁版本（Bug 修复）
- `v1.1.0` - 次版本（新功能）
- `v2.0.0` - 主版本（重大变更）

### 如何恢复自动部署

如果需要恢复每次提交都部署，编辑 `vercel.json`：

```json
{
  "git": {
    "deploymentEnabled": {
      "main": true
    }
  }
}
```

或删除 `git` 配置段。

---

## 🚀 快速部署步骤

### 方式一：通过 Vercel 网页部署（推荐）

#### 1. 访问 Vercel

- 打开浏览器，访问 https://vercel.com
- 使用 GitHub、GitLab 或 Email 注册/登录

#### 2. 导入项目

- 点击 "Add New Project" 或 "Import Project"
- 选择 GitHub 仓库：`ChinaKingKong/solana-token-manager`
- Vercel 会自动检测 Vite 配置

#### 3. 配置项目

```yaml
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

#### 4. 配置环境变量（必需！）

进入项目 **Settings** → **Environment Variables**，逐个添加：

```env
# 必需 - Solana RPC 端点
VITE_SOLANA_MAINNET_RPC=https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY
VITE_SOLANA_DEVNET_RPC=https://solana-devnet.g.alchemy.com/v2/YOUR_API_KEY

# 可选 - IPFS 上传功能（Pinata）
VITE_PINATA_API_KEY=your_api_key
VITE_PINATA_API_SECRET_KEY=your_secret_key
VITE_PINATA_JWT=your_jwt_token
```

**重要提示：**
- ⚠️ **必须以 `VITE_` 开头**：Vite 只能识别以 `VITE_` 开头的环境变量
- 🔒 **不要提交实际的 .env 文件**：已添加到 `.gitignore`
- ✅ **只提交 .env.example**：作为变量名称的模板
- 🔄 **修改后需要重新部署**：环境变量更新后，需要触发新的部署才能生效

#### 5. 首次部署

- 点击 "Deploy" 按钮
- 等待部署完成（通常 1-2 分钟）
- 部署成功后会获得一个 `https://your-project.vercel.app` 域名

#### 6. 创建 Tag 触发生产部署

```bash
# 创建并推送第一个版本标签
git tag v1.0.0 -m "First production release"
git push origin v1.0.0
```

Vercel 会自动检测到 Tag 并开始部署。

---

### 方式二：通过 Vercel CLI 部署

#### 1. 安装并登录 Vercel CLI

```bash
# 全局安装 Vercel CLI
npm install -g vercel

# 登录 Vercel
vercel login
```

#### 2. 首次部署

```bash
# 部署到预览环境
vercel

# 部署到生产环境
vercel --prod
```

---

## 📋 部署前检查清单

- [x] 项目构建成功（`dist/` 文件夹已生成）
- [x] `vercel.json` 配置文件已创建
- [x] `.vercelignore` 文件已创建（避免上传不必要的文件）
- [x] `.env.example` 模板文件已创建
- [x] Tag 部署模式已配置
- [ ] 项目已推送到 GitHub
- [ ] 在 Vercel 添加环境变量
- [ ] 创建 Tag 触发首次生产部署

---

## 🔧 项目配置说明

### vercel.json

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "git": {
    "deploymentEnabled": {
      "main": false  // 禁用主分支自动部署，只通过 Tag 部署
    }
  }
}
```

### 功能特性

- ✅ 自动构建优化
- ✅ 静态资源缓存（1年）
- ✅ HTML 文件不缓存
- ✅ SPA 路由支持（所有路由重定向到 index.html）
- ✅ CORS 头配置
- ✅ CDN 全球分发
- ✅ 自动 HTTPS
- ✅ Tag 触发部署

---

## 🎯 完整部署示例

### 初次部署流程

```bash
# 1. 确保代码已提交并推送
git add .
git commit -m "Ready for Vercel deployment"
git push origin main

# 2. 在 Vercel 网页导入项目
# 访问 https://vercel.com/new
# 选择 GitHub 仓库并点击 Deploy

# 3. 在 Vercel 控制台配置环境变量
# Settings → Environment Variables
# 添加所有 VITE_* 变量

# 4. 创建 Tag 触发生产部署
git tag v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0

# 5. 等待 Vercel 部署完成
# 访问 https://your-project.vercel.app
```

### 后续更新流程

```bash
# 1. 日常开发（不会触发部署）
git add .
git commit -m "feat: 添加新功能"
git push origin main

# 2. 测试无误后，准备发布
git tag v1.1.0 -m "Release v1.1.0: 添加新功能"
git push origin v1.1.0

# 3. Vercel 自动检测 Tag 并部署
```

---

## 💡 提示

### 部署策略

- **开发阶段**：频繁提交代码到 main 分支，不会触发部署
- **发布阶段**：测试通过后创建 Tag，触发生产部署
- **回滚**：如果发现问题，可以回滚到之前的 Tag 或部署版本

### Vercel 免费版限制

- 100 GB 带宽/月
- 无限部署
- 自动 HTTPS
- 全球 CDN
- 无限项目

### 常用 Git Tag 命令

```bash
# 查看所有标签
git tag

# 查看标签详情
git show v1.0.0

# 删除本地标签
git tag -d v1.0.0

# 删除远程标签
git push origin :refs/tags/v1.0.0

# 推送所有标签
git push origin --tags
```

---

## 🔍 环境变量获取

### Solana RPC 端点

推荐使用 Alchemy 或 Helius：

1. **Alchemy**（推荐）
   - 访问 https://www.alchemy.com/solana
   - 注册并创建应用
   - 复制 HTTP API URL

2. **Helius**
   - 访问 https://www.helius.xyz
   - 注册并创建项目
   - 复制 RPC 端点 URL

### Pinata API 密钥

1. 访问 https://app.pinata.cloud
2. 注册/登录账号
3. 进入 API Keys 页面
4. 创建新的 API Key（建议选择 Admin 权限）
5. 复制 API Key、Secret Key 和 JWT

---

需要帮助？查看 [Vercel 文档](https://vercel.com/docs)
