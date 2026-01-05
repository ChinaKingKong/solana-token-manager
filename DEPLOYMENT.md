# 🚀 Vercel 部署指南

## 方式一：通过 Vercel 网页部署（推荐）

### 步骤：

1. **访问 Vercel**
   - 打开浏览器，访问 https://vercel.com
   - 使用 GitHub、GitLab 或 Email 注册/登录

2. **导入项目**
   - 点击 "Add New Project" 或 "Import Project"
   - 选择导入方式：
     - 🔗 **从 GitHub 导入**（推荐）：将项目推送到 GitHub 后导入
     - 📁 **从本地文件夹导入**：直接上传项目文件夹

3. **配置项目**
   ```yaml
   Framework Preset: Vite
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **部署**
   - 点击 "Deploy" 按钮
   - 等待部署完成（通常 1-2 分钟）
   - 部署成功后会获得一个 `https://your-project.vercel.app` 域名

5. **自定义域名**（可选）
   - 在项目设置中添加自定义域名
   - 配置 DNS 记录

---

## 方式二：通过 Vercel CLI 部署

### 1. 登录 Vercel
```bash
cd /Users/lizhigang/Documents/Works/Claude\ Code/solana-token-manager
vercel login
```
会打开浏览器进行授权。

### 2. 部署到生产环境
```bash
vercel --prod
```

### 3. 设置自定义域名（可选）
```bash
vercel domains add your-domain.com
```

---

## 🔧 项目配置说明

项目已包含以下配置文件：

### vercel.json
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite"
}
```

### 功能特性：
- ✅ 自动构建优化
- ✅ 静态资源缓存（1年）
- ✅ HTML 文件不缓存
- ✅ SPA 路由支持（所有路由重定向到 index.html）
- ✅ CDN 全球分发
- ✅ 自动 HTTPS
- ✅ 无限带宽

---

## 📋 部署前检查清单

- [x] 项目构建成功（`dist/` 文件夹已生成）
- [x] `vercel.json` 配置文件已创建
- [x] `.vercelignore` 文件已创建（避免上传不必要的文件）
- [x] `.env.example` 模板文件已创建
- [ ] 项目已推送到 GitHub
- [ ] 在 Vercel 添加环境变量
- [ ] 选择部署方式并完成部署

---

## 🎯 推荐流程（最快）

1. **将项目推送到 GitHub**
   ```bash
   git init
   git add .
   git commit -m "Ready for Vercel deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/solana-token-manager.git
   git push -u origin main
   ```

2. **在 Vercel 网页导入**
   - 访问 https://vercel.com/new
   - 选择 GitHub 仓库
   - Vercel 会自动检测 Vite 配置
   - 点击 "Deploy"

3. **完成！**
   - 获得 `https://solana-token-manager-xxx.vercel.app`
   - 可在 Vercel 控制台查看部署日志和访问统计

---

## 🔄 持续部署

设置完成后，每次推送到 GitHub 主分支，Vercel 会自动部署新版本！

---

## 📝 环境变量配置（必需）

项目依赖环境变量才能正常运行。参照 `.env.example` 文件中的变量列表。

### 在 Vercel 控制台添加环境变量：

1. **进入项目设置**
   - 登录 Vercel 控制台
   - 选择你的项目
   - 点击顶部的 **Settings** 标签

2. **添加环境变量**
   - 在左侧菜单选择 **Environment Variables**
   - 点击 **Add New** 按钮
   - 逐个添加以下变量：

   ```env
   # 必需 - Solana RPC 端点
   VITE_SOLANA_MAINNET_RPC=https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY
   VITE_SOLANA_DEVNET_RPC=https://solana-devnet.g.alchemy.com/v2/YOUR_API_KEY

   # 可选 - IPFS 上传功能（Pinata）
   VITE_PINATA_API_KEY=your_api_key
   VITE_PINATA_API_SECRET_KEY=your_secret_key
   VITE_PINATA_JWT=your_jwt_token
   ```

3. **重要提示**
   - ⚠️ **必须以 `VITE_` 开头**：Vite 只能识别以 `VITE_` 开头的环境变量
   - 🔒 **不要提交实际的 .env 文件**：已添加到 `.gitignore`
   - ✅ **只提交 .env.example**：作为变量名称的模板
   - 🔄 **修改后需要重新部署**：环境变量更新后，需要触发新的部署才能生效

4. **环境选择**
   - 选择应用到哪些环境：
     - `Production` - 生产环境
     - `Preview` - 预览环境
     - `Development` - 开发环境
   - 建议全选，以便在所有环境中使用

5. **保存并重新部署**
   - 添加完所有变量后，点击 **Save**
   - 进入 **Deployments** 标签
   - 点击最新部署右侧的 **...** 菜单
   - 选择 **Redeploy** 以应用新的环境变量

---

## 💡 提示

- 首次部署建议使用测试环境验证
- 生产环境部署前确保所有功能测试通过
- Vercel 免费版限制：
  - 100 GB 带宽/月
  - 无限部署
  - 自动 HTTPS
  - 全球 CDN

需要帮助？查看 [Vercel 文档](https://vercel.com/docs)
