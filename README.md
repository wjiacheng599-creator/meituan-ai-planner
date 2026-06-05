# 小美—本地生活智能小帮手

小美是一款面向本地生活场景的 AI 智能规划应用。它不只是生成一份静态行程，而是围绕“吃什么、去哪玩、怎么走、如何预订、是否超预算、多人如何达成共识”等真实生活决策，构建了一套从需求理解、行程生成、路线规划、Agent 执行到支付订单管理的完整体验。

项目以美团本地生活场景为核心，结合大模型、地图服务、偏好记忆、多人协同和可视化交互，尝试让 AI 从“回答问题”进一步走向“帮用户完成任务”。

## 核心能力

### 智能行程生成

用户可以用自然语言描述需求，例如“周末带家人吃饭逛逛”“给朋友安排一个半日约会路线”“想找附近适合小朋友的活动”。小美会综合时间、地点、预算、成员偏好、天气和活动类型，生成结构化本地生活方案。

### 本地生活 Agent 执行

小美不仅展示推荐结果，还模拟真实 Agent 执行链路，包括：

- 搜索餐厅、景点、电影、酒店等本地生活资源
- 检查可用性、排队情况和预订条件
- 自动执行预订步骤
- 生成执行过程和工具调用结果
- 支持失败兜底和替代方案推荐

### 支付与订单管理

项目内置完整的模拟支付和订单链路：

- 多种支付方式选择
- 支付成功后自动生成订单
- 订单列表、订单详情、取消订单、退款申请
- 行程状态与订单状态联动

### 多人协同行程决策

针对家庭、朋友、情侣、团队出行等场景，小美支持多人偏好协同：

- 成员画像与偏好建模
- 共同投票与冲突识别
- 根据“照顾弱势成员 / 效率优先 / 平衡共识”等策略生成方案
- 自动解释推荐理由

### 地图与路线规划

基于高德地图能力，小美支持：

- POI 搜索
- 静态地图展示
- 路线规划
- 步行、驾车、公交等出行方式
- 多点行程排序和路线优化

### Copilot 行程管家

生成行程后，用户仍可以继续和小美对话：

- 调整预算
- 替换活动
- 改变出发时间
- 增加餐厅、景点或服务
- 根据天气、距离、成员偏好重新优化路线

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | React 19、TypeScript、Vite、Tailwind CSS、Zustand |
| 后端 | Express、TypeScript、SQLite、better-sqlite3 |
| AI 能力 | DashScope 通义千问、LongCat 备用链路、工具调用 Agent |
| 地图服务 | 高德地图 Web API、JS API |
| 状态管理 | Zustand、本地缓存、服务端持久化 |
| 部署 | Vercel 前端、Railway 后端 |
| 测试 | Vitest、Playwright |

## 系统架构

```text
用户输入
  ↓
自然语言理解与意图识别
  ↓
AI 行程生成
  ↓
候选 POI / 活动 / 餐厅 / 服务检索
  ↓
约束求解与路线优化
  ↓
结构化行程展示
  ↓
Agent 执行预订链路
  ↓
支付模拟与订单管理
  ↓
行程记录、分享与复盘
```

## 前端结构

```text
src/
├── components/          页面与业务组件
│   ├── screens/         Home、Itinerary、Payment、Orders 等核心页面
│   ├── itinerary/       行程卡片、执行面板、路线概览、预算分析
│   └── ui/              通用 UI 组件
├── hooks/               页面逻辑与状态编排
├── services/            AI、地图、Agent、订单、服务端 API
├── store/               Zustand 全局状态
├── utils/               路线、缓存、任务状态等工具函数
└── types/               业务类型定义
```

## 后端结构

```text
server/
├── index.ts             Express 服务入口
├── controllers/         支付、订单、行程等 HTTP 控制器
├── services/            Agent、支付、订单、可用性等业务逻辑
├── repository/          SQLite 数据访问层
├── middleware/          鉴权、限流、Cookie、安全中间件
└── api/                 语音、视觉、代理等扩展 API
```

## 关键设计亮点

### 1. 从“规划”到“执行”的完整闭环

传统 AI 行程工具通常停留在推荐文本，小美将流程延伸到预订、支付、订单和复盘，形成更接近真实本地生活平台的产品闭环。

### 2. 工具调用式 Agent

Agent 执行过程被拆分为搜索、检查、预订、排队、替代推荐等工具，前端可以实时展示每一步状态，让用户理解 AI 正在做什么，而不是只等待一个最终答案。

### 3. 面向多人场景的偏好协同

项目不仅考虑单个用户偏好，也考虑家庭和团队场景中的偏好冲突，通过协同策略生成更合理的折中方案。

### 4. 真实服务集成与工程化部署

项目接入地图、AI、后端数据库、跨域认证、支付订单和线上部署，具备完整 Web 应用工程结构，而不是单页 Demo。

## 快速开始

```bash
npm install
npm run dev
```

启动后端 API：

```bash
npm run dev:api
```

生产构建：

```bash
npm run build
```

类型检查：

```bash
npm run type-check
```

运行测试：

```bash
npm test
```

## 环境变量示例

```env
# API
VITE_API_BASE_URL=http://localhost:3000
COOKIE_SECRET=your_cookie_secret

# AI
DASHSCOPE_API_KEY=your_dashscope_api_key
LONGCAT_API_KEY=your_longcat_api_key
VITE_AI_PROVIDER=dashscope

# Agent
VITE_USE_REAL_AGENT=false
VITE_DEMO_MODE_FAST=true

# AMap
AMAP_KEY=your_amap_web_key
VITE_AMAP_KEY=your_amap_js_key
VITE_AMAP_JS_KEY=your_amap_js_key
VITE_AMAP_SECURITY_CODE=your_amap_security_code
VITE_AMAP_USE_PROXY=true
VITE_AMAP_PROXY_HOST=/api/amap

# CORS
FRONTEND_ORIGIN=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
```

## 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动前端开发服务 |
| `npm run dev:api` | 启动后端 API 服务 |
| `npm run build` | 构建生产版本 |
| `npm run type-check` | TypeScript 类型检查 |
| `npm run test` | 运行单元测试 |
| `npm run validate` | 类型检查、Lint、格式检查和测试 |

## 部署说明

当前项目采用前后端分离部署：

- 前端：Vercel
- 后端：Railway
- 数据：SQLite
- 地图：高德地图 API
- AI：DashScope / LongCat

生产环境需要确保：

```env
NODE_ENV=production
FRONTEND_ORIGIN=https://your-frontend-domain.com
CORS_ORIGINS=https://your-frontend-domain.com
VITE_API_BASE_URL=https://your-api-domain.com
```

如果面向中国大陆用户访问，建议绑定自定义域名，并准备国内可访问的备用部署或 CDN 方案，以提升稳定性。

## 竞赛价值

小美围绕美团本地生活的核心业务场景，探索 AI Agent 在真实服务链路中的应用方式。它将行程规划、商家推荐、地图路线、协同决策、预订执行、支付订单和用户记忆串联起来，展示了 AI 从“内容生成工具”走向“生活服务助手”的可能性。

## 项目定位

小美不是一个单纯的 AI 聊天机器人，而是一个能够理解需求、拆解任务、调用工具、执行流程并持续陪伴用户完成本地生活决策的智能小帮手。
```
