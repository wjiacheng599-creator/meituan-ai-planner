# Dogfood 报告问题验证与优化方案

## 验证结论总览

| Issue | 问题描述 | 是否真实存在 | 实际严重度 | 根因分类 |
|-------|---------|-------------|-----------|---------|
| ISSUE-001 | 后端未启动时页面卡死 | ✅ 真实存在 | 🟡 High | 缺少超时保护 |
| ISSUE-002 | "选择此项目"按钮无效 | ✅ 真实存在 | 🔴 Critical | Context 更新传播断裂 |
| ISSUE-003 | 经济版/标准版价格相同 | ✅ 真实存在 | 🟡 High | LLM 输出无校验 |
| ISSUE-004 | "规划中"文字残留 | ✅ 真实存在 | 🟡 Medium | loading 状态未清理 |
| ISSUE-005 | 活动图片无法加载 | ✅ 真实存在 | 🟡 Medium | picsum.photos 国内不可用 |
| ISSUE-006 | 终点无具体地址 | ✅ 真实存在 | 🟢 Low | 硬编码文本 |

---

## ISSUE-001: 后端未启动时页面卡死

### 验证结果：✅ 真实存在（严重度调整为 High）

**原报告描述**：后端服务未启动时，页面卡在"生成行程方案"，无错误提示。

**代码验证**：

调用链路：`useHomeChat.ts:526` → `generatePlan()` → `generatePlanViaServer()` → `POST /api/plans/generate`

1. **`useHomeChat.ts:526`** — 调用 `generatePlan` 时第 3 个参数传 `undefined`（未传 signal）：
   ```ts
   const generatedPlan = await generatePlan(constructedQuery, weatherDataForPlan?.city, undefined, dna);
   ```

2. **`serverApi.ts:245-262`** — `generatePlanViaServer` 没有内置默认超时：
   ```ts
   signal: payload.signal,  // signal = undefined，无超时保护
   ```

3. **存在降级机制**：`planGenerator.ts:545-573` 中，如果服务端调用失败会降级到 `generatePlanLocally`，后者通过 `CascadingProvider`（DashScope → LongCat → Mock）逐级尝试，每级有 30-60 秒超时。

4. **但问题在于**：当后端完全不可达时，`fetch` 请求会因为 `ECONNREFUSED` 快速失败并进入 catch → 降级到本地 LLM。如果 LLM API key 未配置或所有 provider 都失败，最终会走到 `MockProvider`，它会返回一个 mock plan。

**修正判断**：在后端完全不可达（ECONNREFUSED）的情况下，降级机制**理论上应该生效**，不会永久卡死。但降级链路较长（DashScope 多模型轮转 + LongCat + Mock），总耗时可能达到 **2-3 分钟**，用户体验上等同于"卡死"。此外，如果后端挂起（不返回也不断开），则 `fetch` 会真正卡住（无 signal 超时）。

### 优化方案

**文件**：`src/hooks/useHomeChat.ts`

在第 526 行传入 `AbortSignal.timeout()`：
```ts
const generatedPlan = await generatePlan(
  constructedQuery,
  weatherDataForPlan?.city,
  AbortSignal.timeout(60000),  // 60 秒超时保护
  dna
);
```

**文件**：`src/services/serverApi.ts`

在 `generatePlanViaServer` 中添加默认超时：
```ts
signal: payload.signal || AbortSignal.timeout(30000),
```

**文件**：`src/hooks/useHomeChat.ts`（错误处理增强）

在 catch 块中区分错误类型，向用户展示更友好的提示：
```ts
} catch (err) {
  if (sessionSnapshot !== activeSessionId) return;
  const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
  const msg = isTimeout
    ? '规划请求超时，服务器可能繁忙，请稍后重试。'
    : '抱歉，规划线路时遇到了网络问题，请重试。';
  setMessages(prev => [...prev.filter(m => m.id !== pipelineId),
    { id: (Date.now() + 2).toString(), type: 'assistant', content: msg }]);
}
```

---

## ISSUE-002: "选择此项目"按钮点击无反应

### 验证结果：✅ 真实存在（Critical）

**原报告描述**：点击"选择此项目"后，页面无任何变化，底部栏仍显示"先勾选要执行的项目"。

**代码验证** — 完整调用链追踪：

1. **按钮 onClick**（`ActivityCard.tsx:224`）：调用 `onToggleSelect?.(activity.id)`
2. **Store 更新**（`appStore.ts:370-390`）：`toggleSelectedId` 正确更新 `plannerTaskStates` 中的 `selectedActivityIds`
3. **Context 传播断裂**（`App.tsx:185-198`）：
   ```ts
   const appStateContext = useMemo(() => ({
     ...appStateContextRef.current,
     get selectedIds() { return appStateContextRef.current.selectedIds; },
     // ... 其他 getter
   } as typeof appStateContextRef.current), [screen]);  // ← 依赖仅 [screen]！
   ```
4. **AppRouterInner 被 React.memo 包裹**（`AppRouter.tsx:334`）：
   ```ts
   export default React.memo(AppRouterInner);
   ```
   其 props 仅 `{ streamingText, isStreaming }`，不包含 `selectedIds`。

**根因**：
- 用户点击按钮 → Zustand store 更新 → `App.tsx` 重新渲染 → `appStateContextRef.current` 被更新
- 但 `useMemo` 依赖 `[screen]` 未变 → Context value 对象**不变**
- `AppRouterInner` 被 `React.memo` 包裹，props 未变 → **不重新渲染**
- `AppRouterInner` 内部通过 `useAppStateContext()` 读取 Context，但 Context reference 未变 → 读到的 `selectedIds` 是**旧值**（getter 只在渲染时调用，不渲染就不调用）
- 结果：`Itinerary` 组件收到的 `selectedIds` 始终为空 Set → 按钮视觉无变化

### 优化方案

**文件**：`src/App.tsx`

将 `selectedIds` 和 `bookedIds` 加入 `useMemo` 依赖数组：

```ts
const selectedIds = appStateContextRef.current.selectedIds;
const bookedIds = appStateContextRef.current.bookedIds;

const appStateContext = useMemo(() => ({
  ...appStateContextRef.current,
  get screen() { return appStateContextRef.current.screen; },
  get plan() { return appStateContextRef.current.plan; },
  get selectedIds() { return appStateContextRef.current.selectedIds; },
  get bookedIds() { return appStateContextRef.current.bookedIds; },
  // ... 其他 getter 不变
} as typeof appStateContextRef.current), [screen, selectedIds, bookedIds]);
```

这样当 `selectedIds` 变化时，Context value 会更新 → `AppRouterInner`（通过 `useContext`）检测到 Context 变化 → 重新渲染 → `Itinerary` 收到新的 `selectedIds` → ActivityCard 的 `isSelected` 更新。

---

## ISSUE-003: 经济版和标准版价格相同

### 验证结果：✅ 真实存在（High）

**原报告描述**：经济版 ¥95/人 和标准版 ¥95/人 价格完全相同。

**代码验证**：

存在两条价格生成路径：

1. **LLM 生成路径**（`planGenerator.ts:341-348`）：prompt 要求 LLM 生成 3 个不同价格的版本，但**没有代码校验** LLM 输出的价格是否真的不同。
2. **Fallback 路径**（`Itinerary.tsx:480-484`）：当 LLM 未输出 `budgetOptions` 时，用 `baseTotal * 0.6/1.0/1.6` 计算。当 `baseTotal` 较小时，`Math.round()` 可能导致价格趋同。

从测试结果看（经济版和标准版都是 ¥95/人），最可能的原因是 **LLM 直接输出了相同的 `perPerson` 值**，前端未做校验。

### 优化方案

**文件**：`src/components/screens/Itinerary.tsx` 和 `src/components/screens/Overview.tsx`

在使用 `budgetOptions` 之前添加校验和修正逻辑：

```ts
const budgetOptions = useMemo(() => {
  const raw = plan?.budgetOptions?.length ? plan.budgetOptions : [
    { label: '经济版', perPerson: Math.round(baseTotal * 0.6 / peopleCount), total: Math.round(baseTotal * 0.6), strategy: '' },
    { label: '标准版', perPerson: Math.round(baseTotal / peopleCount), total: baseTotal, strategy: '' },
    { label: '品质版', perPerson: Math.round(baseTotal * 1.6 / peopleCount), total: Math.round(baseTotal * 1.6), strategy: '' },
  ];

  // 校验：确保三个版本价格有区分度
  const prices = raw.map(o => o.perPerson);
  const allSame = prices.every(p => p === prices[0]);
  if (allSame && prices[0] > 0) {
    // 强制按比例调整
    const base = prices[0];
    return raw.map((o, i) => ({
      ...o,
      perPerson: i === 0 ? Math.round(base * 0.7) : i === 1 ? base : Math.round(base * 1.5),
      total: i === 0 ? Math.round(base * 0.7 * peopleCount) : i === 1 ? base * peopleCount : Math.round(base * 1.5 * peopleCount),
    }));
  }
  return raw;
}, [plan?.budgetOptions, baseTotal, peopleCount]);
```

---

## ISSUE-004: "规划中"文字在路线加载完成后残留

### 验证结果：✅ 真实存在（Medium）

**原报告描述**：出行方式区域显示"规划中"，但驾车路线已加载完成。

**代码验证**：

1. **`Itinerary.tsx:563-568`** — 初始化时将**所有**交通方式设为 loading：
   ```ts
   setMultiRouteLoading({
     driving: true, taxi: true, transit: true, cycling: true, walking: true
   });
   ```

2. **`Itinerary.tsx:811`** — 成功后只重置**当前**交通模式：
   ```ts
   setMultiRouteLoading(prev => ({ ...prev, [travelMode]: false }));
   ```

3. **`MultiRouteSelector.tsx:46`** — "规划中"显示条件：
   ```ts
   {Object.values(loading).some(v => v) && (<span>规划中</span>)}
   ```

**根因**：`driving` 加载完成后设为 `false`，但 `taxi/transit/cycling/walking` 仍为 `true`（它们从未被加载，也没有被重置），导致 `Object.values(loading).some(v => v)` 始终为 `true`。

### 优化方案

**文件**：`src/components/screens/Itinerary.tsx`

在 `loadRoute` 成功完成后，将非当前模式的 loading 也设为 `false`：

```ts
// 在 buildMapForMode 成功后（约第 811 行之后）
setMultiRouteLoading(prev => {
  const next = { ...prev, [travelMode]: false };
  // 非当前模式如果从未加载过，也标记为非 loading（等用户切换时再懒加载）
  for (const key of Object.keys(next)) {
    if (key !== travelMode && next[key as keyof typeof next]) {
      next[key as keyof typeof next] = false;
    }
  }
  return next;
});
```

或者更简洁的方案：初始化时只设当前模式为 `true`：
```ts
setMultiRouteLoading({
  driving: travelMode === 'driving',
  taxi: travelMode === 'taxi',
  transit: travelMode === 'transit',
  cycling: travelMode === 'cycling',
  walking: travelMode === 'walking',
});
```

---

## ISSUE-005: 活动图片无法加载

### 验证结果：✅ 真实存在（Medium）

**原报告描述**：行程卡片中活动图片区域为空白。

**代码验证**：

1. **`imageLibrary.ts`** — 所有图片 URL 使用 `picsum.photos`：
   ```ts
   const scenicImages = ['https://picsum.photos/seed/scenic1/1200/800', ...];
   ```

2. `picsum.photos` 是国外服务，在国内网络环境下**访问不稳定或完全不可用**。

3. **`GradientImg.tsx:28-32`** — 图片加载失败时 fallback 到渐变色背景，但渐变色背景在视觉上不够直观。

4. 行程卡片使用 `plan.activities[0]?.imageUrl`（`SavedPlans.tsx:29`），这个 `imageUrl` 来自 LLM 生成时调用 `getFeedImage()`，返回的也是 picsum URL。

### 优化方案

**方案 A（推荐）**：使用高德 POI 照片作为首选图片源

**文件**：`src/services/imageLibrary.ts`

添加高德图片作为首选，picsum 作为 fallback：
```ts
export function getActivityImage(activity: Activity): string {
  // 优先使用活动自带的图片（来自高德 API）
  if (activity.imageUrl && !activity.imageUrl.includes('picsum.photos')) {
    return activity.imageUrl;
  }
  // 使用高德静态图 API 生成地点图片
  if (activity.lat && activity.lng) {
    return `https://restapi.amap.com/v3/staticmap?location=${activity.lng},${activity.lat}&zoom=15&size=400*300&key=${AMAP_KEY}`;
  }
  // 最后 fallback 到 picsum
  return getRealImageByTopic(activity.title || '', activity.id || '');
}
```

**方案 B（快速修复）**：将 picsum.photos 替换为国内可用的图片服务

---

## ISSUE-006: 终点无具体地址

### 验证结果：✅ 真实存在（Low）

**原报告描述**：起点和终点只显示"温馨的家"和"当前定位"，无具体地址。

**代码验证**：

1. **`HomeCard.tsx:11`** — `location` prop 被声明但**完全未使用**：
   ```ts
   function HomeCard({ title, index, travelTime }: HomeCardProps) {
     // location prop 被忽略了
   ```

2. **`Itinerary.tsx:578`** — homeLocation 的 name 硬编码为 `'当前位置'`：
   ```ts
   homeLocation = { lat: userLoc.lat, lng: userLoc.lng, name: '当前位置' };
   ```

3. **`HomeCard.tsx:57`** — "当前定位" 硬编码在 JSX 中：
   ```ts
   <p>当前定位</p>
   ```

4. **`apiAdapter.ts:290-305`** — 有 `reverseGeocodeCity` 函数可做逆地理编码，但只返回城市名，未用于 HomeCard。

### 优化方案

**文件**：`src/components/itinerary/HomeCard.tsx`

使用 `location` prop 渲染实际地址：
```ts
function HomeCard({ title, index, location, travelTime }: HomeCardProps) {
  const displayName = location?.name || '当前位置';
  // ...
  <p className="text-[11px] leading-relaxed mb-2 text-[var(--app-text)]">
    {displayName}
  </p>
  <span className="text-[9px] ...">{location?.name || '温馨的家'}</span>
```

**文件**：`src/components/screens/Itinerary.tsx`

在 `loadRoute` 中调用高德逆地理编码获取精确地址：
```ts
if (userLoc) {
  const address = await reverseGeocode(userLoc.lat, userLoc.lng);
  homeLocation = { lat: userLoc.lat, lng: userLoc.lng, name: address || '当前位置' };
}
```

---

## 实施优先级

| 优先级 | Issue | 改动文件 | 改动量 | 影响范围 |
|--------|-------|---------|-------|---------|
| P0 | ISSUE-002 | `App.tsx` | 3 行 | 核心功能完全不可用 |
| P1 | ISSUE-001 | `useHomeChat.ts`, `serverApi.ts` | 10 行 | 用户体验严重受损 |
| P1 | ISSUE-004 | `Itinerary.tsx` | 5 行 | 用户困惑 |
| P2 | ISSUE-003 | `Itinerary.tsx`, `Overview.tsx` | 15 行 | 功能价值降低 |
| P2 | ISSUE-005 | `imageLibrary.ts` | 20 行 | 视觉体验差 |
| P3 | ISSUE-006 | `HomeCard.tsx`, `Itinerary.tsx` | 10 行 | 信息不够完整 |
