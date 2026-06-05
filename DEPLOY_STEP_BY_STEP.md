# 🚀 美团AI规划师 - 保姆级部署教程

## 前言
只需要 30 分钟，就能让评委在线访问您的应用！

---

## 📋 准备清单（先准备好这些）

| 项目 | 说明 | 获取方式 |
|------|------|----------|
| GitHub 账号 | 用于托管代码 | https://github.com 注册 |
| 阿里云 DashScope API Key | AI 功能 | https://bailian.console.aliyun.com/ |
| 高德地图 API Key | 地图功能 | https://console.amap.com/ |
| 30 分钟时间 | 部署时间 | - |

---

## 第一步：把代码推送到 GitHub（5分钟）

### 1.1 初始化 Git（如果还没有）
```bash
cd /Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition
git init
git add .
git commit -m "Initial commit for competition"
```

### 1.2 创建 GitHub 仓库
1. 访问 https://github.com/new
2. 仓库名称：`meituan-ai-planner`
3. 选择 **Public**（公开，方便部署平台访问）
4. 点击 **Create repository**

### 1.3 推送代码
```bash
git remote add origin https://github.com/你的用户名/meituan-ai-planner.git
git branch -M main
git push -u origin main
```

---

## 第二步：部署后端（Railway）（12分钟）

### 2.1 注册并登录 Railway
1. 访问 https://railway.app
2. 点击 **"Start New Project"**
3. 使用 GitHub 账号登录（点击 "Login with GitHub"）

### 2.2 创建项目
1. 点击 **"New Project"**
2. 选择 **"Deploy from repo"**
3. 选择你刚推送到 GitHub 的仓库

### 2.3 配置环境变量（最重要！）
在项目页面，点击 **"Variables"** 标签页，添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DASHSCOPE_API_KEY` | 你的阿里云API密钥 | 从 https://bailian.console.aliyun.com/ 获取 |
| `LONGCAT_API_KEY` | （可选）留空 | 如果没有可以不填 |
| `AMAP_KEY` | 你的高德地图Web服务密钥 | 从高德控制台获取（Web服务类型） |
| `COOKIE_SECRET` | 随便填一串字符 | 例如：`my-super-secret-key-12345` |
| `API_PORT` | `8788` | 固定这个值 |
| `NODE_ENV` | `production` | 固定这个值 |

### 2.4 启动部署
1. 回到 **"Deployments"** 标签页
2. 点击 **"Deploy"** 按钮
3. 等待 2-5 分钟，直到状态变成 **"Success"**

### 2.5 获取后端地址
1. 在项目页面，点击右上角的 **"Settings"**
2. 找到 **"Domains"** 部分
3. 复制分配给你的地址，例如：`https://meituan-ai-planner-production.up.railway.app`
4. **保存这个地址！** 下一步要用

---

## 第三步：部署前端（Vercel）（10分钟）

### 3.1 注册并登录 Vercel
1. 访问 https://vercel.com
2. 点击 **"Sign Up"**
3. 使用 GitHub 账号登录

### 3.2 导入项目
1. 点击 **"Add New"** → **"Project"**
2. 选择你的 GitHub 仓库
3. 点击 **"Import"**

### 3.3 配置环境变量（关键！）
在项目配置页面，找到 **"Environment Variables"** 部分，添加以下变量：

| 变量名 | 值 |
|--------|-----|
| `VITE_API_BASE_URL` | 你刚才从 Railway 复制的地址，例如 `https://xxx.up.railway.app` |
| `VITE_AMAP_KEY` | 你的高德地图 JS API 密钥 |
| `VITE_AMAP_JS_KEY` | 和上面一样 |
| `VITE_AMAP_SECURITY_CODE` | 你的高德安全密钥 |
| `VITE_AMAP_USE_PROXY` | `true` |
| `VITE_AMAP_PROXY_HOST` | `/api/amap` |
| `VITE_AI_PROVIDER` | `dashscope` |
| `VITE_USE_REAL_AGENT` | `false` |
| `VITE_DEMO_MODE_FAST` | `true` |

### 3.4 开始部署
1. 点击 **"Deploy"** 按钮
2. 等待 2-3 分钟

### 3.5 完成！
部署成功后，Vercel 会显示你的应用地址，例如：
`https://meituan-ai-planner.vercel.app`

**恭喜你！现在可以把这个链接发给评委了！**

---

## 第四步：验证部署（3分钟）

1. 打开 Vercel 给你的网址
2. 测试首页聊天
3. 测试生成行程
4. 测试 Agent 执行

一切正常就可以了！

---

## ❓ 常见问题

### Q: 构建失败了怎么办？
A: 检查环境变量是否正确配置，特别是 API Key。

### Q: 地图不显示？
A: 去高德控制台，在你的 JS API Key 配置里添加 Vercel 的域名到白名单。

### Q: 应用休眠了？
A: 免费版会在无活动时休眠，重新访问等待几秒即可。

### Q: 想换个部署平台？
A: 可以用 Render 代替 Railway，配置类似。

---

## 📞 需要帮助？
按照以上步骤操作，遇到问题随时检查：
1. 环境变量是否正确
2. 地址是否复制正确（不要丢了 https://）
3. API Key 是否有效

祝您比赛顺利！🎉
