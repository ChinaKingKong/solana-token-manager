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
- [ ] Vercel 账户已登录
- [ ] 选择部署方式

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

## 📝 环境变量（如需要）

如果项目需要环境变量，在 Vercel 控制台的 Settings > Environment Variables 中添加：
- `VITE_SOLANA_RPC_URL`
- `VITE_SOLANA_NETWORK`
- 其他自定义变量

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
