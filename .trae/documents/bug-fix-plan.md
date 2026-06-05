# 美团AI规划师 — 交互链路 Bug 测试报告与修复计划

## 概述

通过深度代码审查（非运行时测试），覆盖了 5 条核心交互链路：首页→行程生成、Agent 执行、预订→支付→订单、状态管理、行程页交互。共发现 **28 个 bug**，按严重程度分为 3 级。

---

## 🔴 P0 — 必须修复（影响核心流程，6 个）

### Bug 1: Itinerary.tsx `displayActivities` 前向引用导致 TDZ 崩溃
- **文件**: [src/components/screens/Itinerary.tsx:L467-L490](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/components/screens/Itinerary.tsx#L467-L490)
- **问题**: `displayActivities` 在 L467 被使用，但在 L490 才声明。`const` 有暂时性死区（TDZ），运行时会抛出 `ReferenceError`。这意味着**整个行程页在运行时会崩溃**。
- **修复**: 将 L467-469 的 `selectedActivities` 计算移到 L490 之后（`displayActivities` 声明之后）。

### Bug 2: Agent SSE buffer 残留数据丢失
- **文件**: [src/services/agent.ts:L665-L694](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/services/agent.ts#L665-L694)
- **问题**: `while(true)` 循环在 `done: true` 时直接 break，但 `buffer` 中可能还有未处理的完整 SSE 行（特别是 `done` 事件）。丢失后 `finalResult` 为 null，抛出 `"No result received from server"` 错误。
- **修复**: 循环结束后，处理 buffer 中的剩余数据：
  ```typescript
  // After the while loop, process remaining buffer
  if (buffer.trim()) {
    const remainingLines = buffer.split('\n');
    for (const line of remainingLines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'done' && data.result) {
          finalResult = data.result;
        } else if (data.type === 'error') {
          throw new Error(data.error);
        }
      } catch (parseErr) { /* same logic as above */ }
    }
  }
  ```

### Bug 3: Agent SSE 错误事件被 JSON 关键字误过滤
- **文件**: [src/services/agent.ts:L686-L691](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/services/agent.ts#L686-L691)
- **问题**: 当服务端发送 error 事件时，L684 抛出 `new Error(data.error)`。外层 catch 在 L688 检查 `!parseErr.message.includes('JSON')`，如果错误消息恰好包含 "JSON"（如 "JSON parsing failed"），错误会被静默吞没。
- **修复**: 使用更精确的判断方式：
  ```typescript
  } catch (parseErr) {
    if (parseErr instanceof SyntaxError) {
      // JSON parse error — skip malformed line
      console.warn('[agent] Skipping malformed SSE line:', line.substring(0, 100));
    } else {
      throw parseErr; // Re-throw all non-SyntaxError errors
    }
  }
  ```

### Bug 4: Agent AbortError 检测逻辑错误
- **文件**: [src/services/agent.ts:L448](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/services/agent.ts#L448)，[server/services/agentExecute.ts:L180](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/server/services/agentExecute.ts#L180)
- **问题**: `lastError.message === 'AbortError'` 永远不会匹配，因为 `AbortError` 的 `message` 是 `"The operation was aborted"` 而非 `"AbortError"`。`error.name` 才是 `"AbortError"`。
- **修复**: 改为 `lastError.name === 'AbortError'`。

### Bug 5: 天气降级时硬编码城市为"北京"
- **文件**: [src/hooks/useHomeChat.ts:L501-L510](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/hooks/useHomeChat.ts#L501-L510)
- **问题**: 天气获取失败时，降级数据使用硬编码的 `city: '北京'`，但用户可能在任何城市。这会导致后续 `generatePlan` 的 `cityParam` 为"北京"，影响 POI 搜索范围。
- **修复**: 在 try 块开头先获取 city，catch 中使用已获取的 city 或空字符串：
  ```typescript
  let city = '未知';
  try {
    city = await getUserCity();
    const weather = await fetchWeather(city);
    // ...
  } catch {
    weatherDataForPlan = { city, temp: 22, condition: '晴', advice: '天气数据暂时不可用' };
  }
  ```

### Bug 6: SSE error 事件消息中包含 "JSON" 关键字时被静默吞没
- 与 Bug 3 合并处理（同一段代码的两个表现）

---

## 🟡 P1 — 应该修复（影响体验或数据一致性，12 个）

### Bug 7: `fastAgentExecute` 并行 push 导致步骤顺序错乱
- **文件**: [src/services/agent.ts:L716-L751](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/services/agent.ts#L716-L751)
- **问题**: `Promise.all` 中多个异步回调并行 `push` 到共享 `steps` 数组，步骤顺序不确定。
- **修复**: 改为 `for...of` 串行执行，或使用 index 排序后合并。

### Bug 8: `collabDataRef` 的 `useEffect` 时序问题
- **文件**: [src/components/screens/Home.tsx:L255-L265](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/components/screens/Home.tsx#L255-L265)
- **问题**: `useEffect` 是异步的，用户在 collab 数据更新后立即点击发送时，`collabDataRef.current` 可能还是旧值。
- **修复**: 改用 `useLayoutEffect` 确保在浏览器绘制前同步更新 ref。

### Bug 9: Plan 生成竞态 — session 切换后旧结果污染新 session
- **文件**: [src/hooks/useHomeChat.ts:L553-L555](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/hooks/useHomeChat.ts#L553-L555)
- **问题**: 用户在计划生成过程中切换 session，旧的 `handleStartPlan` 完成后会往当前 session 的消息列表追加旧 session 的 plan。
- **修复**: 在生成开始时记录当前 `sessionId`，完成时检查是否仍是活跃 session：
  ```typescript
  const sessionSnapshot = activeSessionId;
  // ... generate ...
  if (sessionSnapshot !== activeSessionIdRef.current) return; // session changed, discard
  ```

### Bug 10: `useAppState()` 返回值引用不稳定导致级联重渲染
- **文件**: [src/hooks/useAppState.ts:L85-L119](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/hooks/useAppState.ts#L85-L119)
- **问题**: 每次渲染返回新对象，`handleGeneratePlan` 的 `useCallback` 缓存失效，每次渲染都重建。
- **修复**: 用 `useMemo` 包裹返回值，或让 `handleGeneratePlan` 直接从 store 读取（不通过 `appState` 中间变量）。

### Bug 11: Itinerary 流式展示中 Copilot 修改 plan 不会重置动画
- **文件**: [src/components/screens/Itinerary.tsx:L841-L870](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/components/screens/Itinerary.tsx#L841-L870)
- **问题**: `plan.id` 不变时流式展示不会重置，但活动内容可能已通过 Copilot 修改。
- **修复**: 增加 `plan.activities` 的引用检查，或使用 activities 的 hash 作为 key。

### Bug 12: Itinerary 路线规划 useEffect 缺少 AbortController
- **文件**: [src/components/screens/Itinerary.tsx:L517-L831](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/components/screens/Itinerary.tsx#L517-L831)
- **问题**: 快速切换 plan 或 travelMode 时，旧的 API 请求继续执行浪费资源。
- **修复**: 使用 `AbortController` 在 cleanup 中取消进行中的请求。

### Bug 13: Overview 路线规划串行执行且无取消机制
- **文件**: [src/components/screens/Overview.tsx:L76-L129](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/components/screens/Overview.tsx#L76-L129)
- **问题**: for 循环中逐个 await 路线规划，且无 AbortController。
- **修复**: 改为 `Promise.all` 并行 + AbortController。

### Bug 14: `/api/executions` 路由导入客户端 `agentExecute` 可能导致递归
- **文件**: [server/index.ts:L16](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/server/index.ts#L16)，[server/index.ts:L953-969](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/server/index.ts#L953-L969)
- **问题**: 该路由调用客户端的 `agentExecute`，内部会尝试调 `/api/agent/execute`（自己调自己）。
- **修复**: 改为直接调用 `executeAgentOnServer`，或删除该路由。

### Bug 15: 服务端 SSE 路由未处理客户端断开连接
- **文件**: [server/index.ts:L180-212](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/server/index.ts#L180-L212)
- **问题**: 客户端断开后服务端继续执行 AI 调用和工具调用，浪费资源。`res.write()` 在连接关闭后可能抛异常。
- **修复**: 监听 `req.on('close')` 设置 abort flag，工具执行前检查。

### Bug 16: `replaceActivityInPlan` 竞态条件
- **文件**: [src/store/appStore.ts:L305-314](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/store/appStore.ts#L305-L314)
- **问题**: 在 `set()` 外部 `get()` 读取状态，读写之间不是原子操作。连续调用两次可能丢失第一次修改。
- **修复**: 改为纯 `set((state) => ...)` 模式。

### Bug 17: `ensureAuth()` 认证失败时静默继续执行
- **文件**: [src/services/serverApi.ts](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/services/serverApi.ts)
- **问题**: 注册失败时不抛异常，下游 `processPayment()` 会收到 401。
- **修复**: `authEnsured = false` 时抛出明确的认证失败错误。

### Bug 18: 支付与订单创建非原子操作
- **文件**: [src/components/screens/Payment.tsx:L94-153](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/components/screens/Payment.tsx#L94-L153)
- **问题**: 先扣款再创建订单，如果订单创建失败，用户的钱被扣了但没有订单。
- **修复**: 后端支付成功后同时创建订单（服务端原子操作），或用 `paymentId` 做幂等去重。

---

## 🟢 P2 — 可以优化（改善代码质量，10 个）

### Bug 19: Agent 客户端与服务端 `max_tokens` 参数名不一致
- **文件**: [src/services/agent.ts:L356](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/services/agent.ts#L356) vs [server/services/agentExecute.ts:L90](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/server/services/agentExecute.ts#L90)
- **修复**: 统一为 `max_tokens`（DashScope 和 LongCat 都支持）。

### Bug 20: 工具处理函数使用 `as` 类型断言无运行时校验
- **文件**: [src/services/tools.ts:L383-415](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/services/tools.ts#L383-L415)
- **修复**: 添加基本的参数校验（如 `input.name || ''`，`Number(input.people) || 1`）。

### Bug 21: `pendingRequests` Map 已完成条目未清理
- **文件**: [src/services/tools.ts:L67-71](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/services/tools.ts#L67-L71)
- **修复**: 在 `finally` 中无条件删除 entry，或添加定时清理。

### Bug 22: `enforceTokenBudget` 在递归调用中未生效
- **文件**: [src/services/agent.ts:L540-541](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/services/agent.ts#L540-L541)
- **修复**: 在 `callDashScopeWithTools` 的递归调用中加入 token 预算检查。

### Bug 23: `updatePlan` 执行两次独立 `set` 调用
- **文件**: [src/store/appStore.ts:L400-403](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/store/appStore.ts#L400-L403)
- **修复**: 合并为单次 `set`。

### Bug 24: `clearAll` 未清理 bootstrap 的 localStorage
- **文件**: [src/store/appStore.ts:L405-431](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/store/appStore.ts#L405-L431)
- **修复**: 同时清理 `meituan_planner_reset_v2_*` 系列键。

### Bug 25: `upsertPlanEverywhere` 中有死代码
- **文件**: [src/store/appStore.ts:L278-279](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/store/appStore.ts#L278-L279)
- **修复**: 删除未使用的 `const { savedPlans } = get()`。

### Bug 26: RAG 缓存 key 过长且对微小变更敏感
- **文件**: [src/services/agent.ts:L489](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/services/agent.ts#L489)
- **修复**: 使用活动 ID 列表而非完整描述文本作为 key。

### Bug 27: `withServerFallback` 工具已导入但从未使用
- **文件**: [src/services/agent.ts:L7](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/services/agent.ts#L7)
- **修复**: 删除未使用的导入。

### Bug 28: `orderApi.ts` 中 `getUserId` 和 `createOrder` 是死代码
- **文件**: [src/services/orderApi.ts:L29-32](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/services/orderApi.ts#L29-L32)
- **修复**: 删除或整合到 Payment.tsx 中使用。

---

## 实施计划

### 第一批：P0 修复（6 个，预计 30 分钟）

| # | Bug | 文件 | 改动 |
|---|-----|------|------|
| 1 | displayActivities TDZ | Itinerary.tsx | 移动 selectedActivities 到 L490 之后 |
| 2 | SSE buffer 残留 | agent.ts | 循环结束后处理 buffer |
| 3+6 | SSE error 过滤 | agent.ts | 改用 SyntaxError 判断 |
| 4 | AbortError 检测 | agent.ts + agentExecute.ts | `.message` → `.name` |
| 5 | 天气城市硬编码 | useHomeChat.ts | 先获取 city 再 try |

### 第二批：P1 修复（12 个，预计 60 分钟）

| # | Bug | 文件 | 改动 |
|---|-----|------|------|
| 7 | fastAgent 步骤乱序 | agent.ts | 串行执行 |
| 8 | collabDataRef 时序 | Home.tsx | useEffect → useLayoutEffect |
| 9 | session 竞态 | useHomeChat.ts | 添加 sessionId 快照检查 |
| 10 | useAppState 引用不稳定 | useAppState.ts | useMemo 包裹 |
| 11 | 流式展示不重置 | Itinerary.tsx | 增加 activities hash 检查 |
| 12 | 路线规划无 Abort | Itinerary.tsx | 添加 AbortController |
| 13 | Overview 串行路线 | Overview.tsx | 改为并行 + Abort |
| 14 | /api/executions 递归 | server/index.ts | 改用 executeAgentOnServer |
| 15 | SSE 未处理断开 | server/index.ts | 监听 req.close |
| 16 | replaceActivityInPlan 竞态 | appStore.ts | 纯 set 模式 |
| 17 | ensureAuth 静默失败 | serverApi.ts | 抛出异常 |
| 18 | 支付非原子操作 | Payment.tsx + server | 后端原子创建订单 |

### 第三批：P2 优化（10 个，预计 30 分钟）

| # | Bug | 文件 | 改动 |
|---|-----|------|------|
| 19 | max_tokens 不一致 | agent.ts / agentExecute.ts | 统一参数名 |
| 20 | 工具参数无校验 | tools.ts | 添加 fallback |
| 21 | pendingRequests 泄漏 | tools.ts | 清理已完成条目 |
| 22 | token 预算未生效 | agent.ts | 递归中检查 |
| 23 | updatePlan 双 set | appStore.ts | 合并为单次 |
| 24 | clearAll 残留 | appStore.ts | 清理 localStorage |
| 25 | 死代码 | appStore.ts | 删除 |
| 26 | RAG key 过长 | agent.ts | 使用 ID 列表 |
| 27 | 未使用导入 | agent.ts | 删除 |
| 28 | 死代码 | orderApi.ts | 删除 |

---

## 验证步骤

1. **P0 修复后**: 运行 `npm run build` 确认编译通过 → 手动打开行程页确认不崩溃 → 测试 Agent 执行确认 SSE 正常
2. **P1 修复后**: 运行 `npm run type-check && npm run lint` → 测试完整流程：首页输入 → 生成行程 → 查看行程 → Agent 执行 → 预订 → 支付
3. **P2 修复后**: 运行 `npm run validate`（type-check + lint + format + test）
