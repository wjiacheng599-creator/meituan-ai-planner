# 美团AI规划师 - 免费部署方案

## 🎯 部署目标
让评委可以在线预览完整应用，包括前后端。

---

## 📋 方案概览

### 方案一：Vercel 前端 + Railway 后端（推荐）
- **前端**: Vercel（免费）
- **后端**: Railway（免费额度）
- **优势：配置简单，部署快

### 方案二：Netlify 前端 + Render 后端
- **前端**: Netlify（免费）
- **后端**: Render（免费额度）
- **优势：支持静态资源优化好

### 方案三：Vercel 全栈（Serverless Functions）
- **全栈**: Vercel
- **优势：单一平台管理

---

## 🚀 推荐方案详细步骤

### 一、准备工作

1. **注册以下平台账号（全部免费）：
   - GitHub
   - Vercel
   - Railway
   - 阿里云 DashScope（获取 API Key）
   - 高德地图（获取 API Key）

2. **准备项目代码：
   - 确保项目已提交到 GitHub

---

### 二、部署后端（Railway）

#### 步骤 1: 创建 Railway 项目
1. 访问 https://railway.app
2. 使用 GitHub 账号登录
3. 点击 "New Project"
4. 选择 "Deploy from repo"
5. 选择你的项目仓库

#### 步骤 2: 配置后端
1. 在 Railway 项目中添加以下环境变量：
```env
DASHSCOPE_API_KEY=your_dashscope_api_key
LONGCAT_API_KEY=your_longcat_api_key
AMAP_KEY=your_web_service_key
COOKIE_SECRET=your_random_secret
API_PORT=8788
NODE_ENV=production
```

2. 修改 `package.json` 添加启动脚本：
```json
{
  "scripts": {
    "start": "node --import tsx server/index.ts"
  }
}
```

#### 步骤 3: 部署后端
1. 点击 "Deploy"
2. 等待部署完成后，获取后端 URL（如：`https://your-app.up.railway.app`）

---

### 三、部署前端（Vercel）

#### 步骤 1: 创建 Vercel 项目
1. 访问 https://vercel.com
2. 使用 GitHub 账号登录
3. 点击 "Import Project"
4. 选择你的项目仓库

#### 步骤 2: 配置前端配置文件
在项目根目录创建 `vercel.json`：
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "env": {
    "VITE_API_BASE_URL": "https://your-app.up.railway.app",
    "VITE_AMAP_KEY": "your_js_api_key",
    "VITE_AMAP_JS_KEY": "your_js_api_key",
    "VITE_AMAP_SECURITY_CODE": "your_security_code",
    "VITE_AMAP_USE_PROXY": "true",
    "VITE_AMAP_PROXY_HOST": "/api/amap",
    "VITE_AI_PROVIDER": "dashscope",
    "VITE_USE_REAL_AGENT": "false",
    "VITE_DEMO_MODE_FAST": "true"
  }
}
```

#### 步骤 3: 部署前端
1. 点击 "Deploy"
2. 等待部署完成
3. 获得应用 URL 即可访问

---

### 四、验证部署

1. 访问前端 URL，测试：
- 首页聊天功能
- 行程生成
- Agent 执行
- 地图展示

---

## 📁 所需配置文件

### vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100
  }
}
```

### render.yaml
```yaml
services:
  - type: web
    name: meituan-ai-planner-api
    env: node
    plan: starter
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: API_PORT
        value: 8788
      - key: DASHSCOPE_API_KEY
        sync: false
      - key: LONGCAT_API_KEY
        sync: false
      - key: AMAP_KEY
        sync: false
      - key: COOKIE_SECRET
        generateValue: true
```

---

## 💡 成本说明

| 平台 | 免费额度 | 限制 |
|------|----------|------|
| Vercel | 无限站点，100GB 带宽/月 | 个人项目 |
| Railway | 500 小时/月运行时间 | 休眠后冷启动 |
| Render | 750 小时/月运行时间 | 15 分钟无活动休眠 |

---

## 📞 技术支持

如有问题，请参考各平台文档：
- Vercel: https://vercel.com/docs
- Railway: https://docs.railway.app
- Render: https://render.com/docs

