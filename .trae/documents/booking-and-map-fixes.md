# 预定流程 Bug 修复 + 地图控件优化方案

## 问题分析

### Bug 1: 预定一个版本后返回显示所有版本都被预定

**根因**：预定状态在**活动级别**追踪，而非**变体级别**。

- `bookedActivityIds: string[]` 只存储活动 ID（[types.ts:L112](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/types.ts#L112)）
- 用户在 Booking.tsx 选择了一个时段+套餐，但预定成功后，整个活动被标记为"已预定"
- 返回时 ActivityCard 检查 `isBooked` 只看活动 ID 是否在 `bookedActivityIds` 中，所有变体都显示为已预定

**修复方案**：
1. 在 `PlannerTaskState` 中新增 `bookedVariants` 字段，记录每个活动的已预定变体信息（时段+套餐）
2. Booking.tsx 预定成功时，将选中的时段和套餐传给 `markActivitiesAsBooked`
3. ActivityCard 显示时，检查当前变体是否已预定，而非整个活动

### Bug 2: 点击一个景点预约会同时预约所有景点

**根因**：[Itinerary.tsx:L501-503](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/components/screens/Itinerary.tsx#L501-503) 中，当没有显式选中活动时，默认全选：

```typescript
const selectedActivities = selectedIds.size > 0
  ? displayActivities.filter(a => selectedIds.has(a.id))
  : displayActivities; // 默认全选！
```

**修复方案**：移除默认全选逻辑。当没有选中活动时，"一键执行"按钮应禁用或提示用户先选择。

### Bug 3: 指南针位置不合理且尺寸过大

**根因**：[MapPanel.tsx:L370](file:///Users/wujiacheng/Documents/Playground/meituan-ai-planner-competition/src/components/itinerary/MapPanel.tsx#L370) 中 ControlBar 位置为 `top: '10px', right: '10px'`，且使用默认尺寸。

**修复方案**：调整位置到右上角偏下，添加 `showControlButton: false` 隐藏多余按钮，仅保留指南针。

### Bug 4: 右下角按钮与缩放控件重叠

**根因**：交通按钮和收起地图按钮在 `right-4 bottom-4`（右下角），与 ToolBar 默认位置重叠。

**修复方案**：
1. 将 ToolBar（缩放控件）移到右下角
2. 将交通按钮和收起地图按钮移到右下角偏上，避免重叠
3. 重新布局控件位置

### 需求 5: 新增定位到当前位置的按钮

**修复方案**：在地图控件区域新增"定位"按钮，点击后使用浏览器 Geolocation 获取当前位置并居中显示。

---

## 实施计划

### Task 1: 修复预定变体状态追踪
- 修改 `PlannerTaskState` 类型，新增 `bookedVariants` 字段
- 修改 `markActivitiesAsBooked` 支持变体信息
- 修改 Booking.tsx 传递变体信息
- 修改 ActivityCard 显示逻辑

### Task 2: 修复默认全选 bug
- 修改 Itinerary.tsx 的 selectedActivities 逻辑
- 当没有选中活动时禁用"一键执行"按钮

### Task 3: 调整地图控件布局
- 调整 ControlBar 位置和尺寸
- 重新布局缩放、交通、收起按钮
- 新增"定位我"按钮

### Task 4: 验证
- typecheck 验证
- 功能验证
