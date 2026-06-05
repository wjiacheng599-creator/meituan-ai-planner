# 🚀 快速部署指南

## 目标
让评委可以在线访问应用，无需任何本地配置。

---

## 推荐方案：Vercel + Railway（免费）

### 第一步：准备代码（5分钟）

1. 将项目推送到 GitHub
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/你的用户名/你的仓库名.git
   git push -u origin main
   ```

---

### 第二步：部署后端（Railway）（10分钟）

1. 访问 [Railway](https://railway.app) 并使用 GitHub 登录
2. 点击 **"New Project"** → **"Deploy from repo"**
3. 选择你的仓库
4. **配置环境变量**（在 Railway 项目设置中）：
   ```
   DASHSCOPE_API_KEY=你的阿里云API密钥
   LONGCAT_API_KEY=你的Longcat密钥（可选）
   AMAP_KEY=你的高德地图Web服务密钥
   COOKIE_SECRET=随机生成的密钥（随便填一串字符）
   API_PORT=8788
   NODE_ENV=production
   ```
5. 点击 **"Deploy"**
6. 等待部署完成后，复制分配的 URL（如 `https://xxxx.up.railway.app`）

---

### 第三步：部署前端（Vercel）（10分钟）

1. 访问 [Vercel](https://vercel.com) 并使用 GitHub 登录
2. 点击 **"Add New"** → **"Project"**
3. 导入你的 GitHub 仓库
4. **配置环境变量**（在 Vercel 项目设置中）：
   ```
   VITE_API_BASE_URL=https://你的railway应用地址.up.railway.app
   VITE_AMAP_KEY=你的高德地图JS API密钥
   VITE_AMAP_JS_KEY=你的高德地图JS API密钥
   VITE_AMAP_SECURITY_CODE=你的高德安全密钥
   VITE_AMAP_USE_PROXY=true
   VITE_AMAP_PROXY_HOST=/api/amap
   VITE_AI_PROVIDER=dashscope
   VITE_USE_REAL_AGENT=false
   VITE_DEMO_MODE_FAST=true
   ```
5. 点击 **"Deploy"**
6. 部署完成后，Vercel 会给你一个网址，这就是你的应用地址！

---

## 验证部署

1. 打开 Vercel 给你的网址
2. 测试以下功能：
   - ✅ 首页聊天
   - ✅ 生成行程
   - ✅ Agent 执行（演示模式）
   - ✅ 地图展示

---

## 常见问题

### Q: 部署后 API 请求失败？
A: 检查 `VITE_API_BASE_URL` 是否正确配置为你的 Railway 后端地址。

### Q: 高德地图不显示？
A: 确保你在高德控制台配置了正确的域名白名单。

### Q: 应用休眠了怎么办？
A: 免费版会在无活动时休眠，重新访问等待几秒即可。

---

## 成本估算

| 平台 | 免费额度 | 超出后 |
|------|----------|--------|
| Vercel | 无限 | $0 |
| Railway | 500小时/月 | $0.00023/小时 |
| 总计 | 全免费 | 很低 |

**完全满足比赛评审需求！**

---

## 备选方案：Render 代替 Railway

如果 Railway 无法使用，可以用 Render：
1. 访问 [Render](https://render.com)
2. 部署流程类似，参考 `render.yaml` 配置

---

有问题随时联系！
