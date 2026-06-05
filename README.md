# 美团AI规划师

基于 AI 的本地生活规划应用，为用户提供餐饮、活动、出行等场景的智能化规划服务。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Tailwind CSS v4 + Zustand v5 + Vite v6 |
| 后端 | Express + TypeScript + better-sqlite3 |
| AI | 阿里云 Dashscope (qwen-turbo) + 美团 LongCat (自动降级) |
| 地图 | 高德地图 API (AMap) |
| 动画 | Motion (Framer Motion) |

## 快速开始

```bash
npm install
npm run dev
```

环境变量 (`.env`)：

```bash
# AI Provider (默认: dashscope)
VITE_AI_PROVIDER=dashscope

# Dashscope API Key (必填)
DASHSCOPE_API_KEY=your_key

# LongCat API Key (备选)
LONGCAT_API_KEY=your_key

# 高德地图
AMAP_KEY=your_key
VITE_AMAP_KEY=your_key
VITE_AMAP_JS_KEY=your_key
VITE_AMAP_SECURITY_CODE=your_code

# Cookie 密钥
COOKIE_SECRET=your_secret
```

## 核心架构

```
前端 (React)
  ├─ 首页对话 → useHomeChat → 生成行程
  ├─ 行程页 → ActivityTimeline + 预算版本切换
  ├─ Agent 执行 → 后端代理 → DashScope/LongCat
  ├─ Copilot 管家 → 后端代理 → AI 对话
  └─ 个人中心 → 行程/订单/预算记录

后端 (Express)
  ├─ /api/plans/generate → 行程生成
  ├─ /api/agent/execute → Agent 执行 (SSE)
  ├─ /api/copilot/chat → Copilot 对话
  ├─ /api/orders → 订单管理
  └─ /api/auth → 认证
```

## AI 服务

- **DashScope** (主): qwen-turbo，免费额度最多
- **LongCat** (备): LongCat-2.0-Preview，自动降级
- **级联策略**: DashScope 失败 → LongCat → Mock (兜底)

## 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动前后端开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run lint` | TypeScript 类型检查 |
| `npm run test` | 运行测试 |

## 项目结构

```
src/
├── components/       # React 组件
│   ├── screens/      # 页面组件 (Home, Itinerary, Profile, Orders...)
│   ├── itinerary/    # 行程组件 (ActivityTimeline, ExecutionPanel, CopilotPanel...)
│   └── ui/           # 通用 UI 组件
├── services/         # 服务层
│   ├── ai/           # AI 服务 (provider, copilot, planGenerator, travelDNA...)
│   ├── agent.ts      # Agent 执行引擎
│   └── serverApi.ts  # 后端 API 调用
├── hooks/            # 自定义 Hooks
├── store/            # Zustand 状态管理
└── utils/            # 工具函数

server/
├── index.ts          # 服务入口
├── controllers/      # 控制器
├── services/         # 业务服务
├── repository/       # 数据层 (SQLite + JSON fallback)
└── middleware/        # 中间件 (rateLimit, cookie, auth)
```

## 功能特性

- 🤖 **AI 行程生成**：基于用户偏好、天气、时间智能规划
- 📋 **三版本预算**：经济版/标准版/品质版，不同活动方案
- 🤝 **Agent 执行**：一键预订餐厅、景点、电影等
- 💬 **Copilot 管家**：实时对话调整行程
- 🗺️ **地图集成**：高德地图 POI 搜索和路线规划
- 👥 **多人协作**：共创行程、投票决策
- 📊 **预算记录**：行程花费统计和分析

## 竞赛说明

本项目为美团AI规划师竞赛参赛项目。
