# 高德 API 全面优化方案

## 一、当前状态总览

本项目对高德地图 JSAPI v2.0 的使用已覆盖：地图初始化、覆盖物绘制（Marker/LabelMarker/Polyline）、LBS 服务（POI 搜索/路线规划/天气/地理编码/IP 定位/坐标转换）、交通路况图层、静态地图降级、代理安全架构。

**做得好的部分**：
- ✅ 安全密钥配置在加载前执行
- ✅ REST API 通过代理保护 Key
- ✅ 天气服务有完整降级策略（高德 → wttr.in → 默认值）
- ✅ 路线规划有超时保护（15 秒）
- ✅ 交通路况图层有自动刷新（180 秒）
- ✅ 静态地图作为交互地图的降级方案
- ✅ 代理服务有路径白名单和图片缓存
- ✅ POI 搜索结果有缓存机制
- ✅ Explore.tsx 已使用 LabelMarker 优化大量标记性能
- ✅ DNS prefetch 已配置 restapi.amap.com

---

## 二、问题分类与优化方案

### 🔴 P0: 安全与合规问题（必须修复）

#### 问题 1: 硬编码 API Key 泄露

**现状**：`apiAdapter.ts:6` 和 `poiImageService.ts:5` 中硬编码了 fallback API Key：
```typescript
const FALLBACK_AMAP_KEY = '3086ea6e4d6169279cca4b4ce6697d9c';
```
这是严重的安全隐患，任何人都可以从源码中提取此 Key。

**修复方案**：
- 移除所有硬编码 Key
- 如果没有配置环境变量，直接返回 null/降级，不使用 fallback Key
- 涉及文件：`src/services/apiAdapter.ts`、`src/services/poiImageService.ts`

#### 问题 2: 安全配置缺少生产环境 serviceHost

**现状**：`amapWeb.ts:33-35` 中安全配置仅使用明文 `securityJsCode`：
```typescript
window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE };
```
根据高德最佳实践，生产环境应使用 `serviceHost` 代理转发，避免安全密钥泄露。

**修复方案**：
- 在 `amapWeb.ts` 中增加 `serviceHost` 支持
- 当配置了 `VITE_AMAP_SERVICE_HOST` 环境变量时，使用代理模式
- 在 `.env.example` 中新增 `VITE_AMAP_SERVICE_HOST` 配置项
- 涉及文件：`src/services/amapWeb.ts`、`.env.example`

---

### 🟠 P1: 功能缺失（高价值改进）

#### 问题 3: 缺少 InfoWindow 信息窗口

**现状**：`Explore.tsx:37` 声明了 `InfoWindow` 类型但从未实例化。用户点击 POI 标记时，只能通过右侧面板查看详情，无法在地图上直接看到信息弹窗。

**改进方案**：
- 在 Explore.tsx 中，点击 POI 标记时显示 InfoWindow
- InfoWindow 展示 POI 名称、地址、评分、距离等关键信息
- 点击 InfoWindow 可跳转到详情面板
- 参考 skill 文档 `references/info-window.md`
- 涉及文件：`src/components/screens/Explore.tsx`

#### 问题 4: 缺少 ControlBar 3D 控制器

**现状**：MapPanel.tsx 已升级为 3D 模式（`viewMode: '3D'`, `pitchEnable: true`, `rotateEnable: true`），但没有添加 ControlBar 控件。用户无法通过 UI 控制俯仰角和旋转角。

**改进方案**：
- 在 MapPanel.tsx 的地图初始化中添加 `AMap.ControlBar` 控件
- ControlBar 提供 3D 旋转、俯仰的 UI 控制按钮
- 需在插件加载中增加 `AMap.ControlBar`
- 参考 skill 文档 `references/api/controls.md`
- 涉及文件：`src/components/itinerary/MapPanel.tsx`

#### 问题 5: 缺少 HawkEye 鹰眼小地图

**现状**：没有鹰眼小地图控件，用户在高缩放级别下容易失去全局视野。

**改进方案**：
- 在 MapPanel.tsx 中添加 `AMap.HawkEye` 控件
- 默认折叠状态，用户可展开查看全局
- 参考 skill 文档 `references/api/controls.md`
- 涉及文件：`src/components/itinerary/MapPanel.tsx`

#### 问题 6: 缺少 3D Buildings 楼块图层

**现状**：3D 模式已启用但没有 3D 楼块图层，城市区域看起来是平面的。

**改进方案**：
- 在 MapPanel.tsx 中添加 `AMap.Buildings` 图层
- 使用默认楼块样式或自定义样式
- 参考 skill 文档 `references/layers.md`
- 涉及文件：`src/components/itinerary/MapPanel.tsx`

#### 问题 7: 缺少地图加载完成回调

**现状**：地图初始化后没有监听 `complete` 事件，无法确保地图资源完全加载后再进行后续操作。

**改进方案**：
- 在 `new AMap.Map()` 后监听 `map.on('complete', callback)`
- 在 complete 回调中再添加覆盖物和控件
- 参考 skill 文档 `references/events.md`
- 涉及文件：`src/components/itinerary/MapPanel.tsx`、`src/components/screens/Explore.tsx`

---

### 🟡 P2: 体验优化

#### 问题 8: 路线渲染后缺少 setFitView

**现状**：MapPanel.tsx 中路线渲染完成后，没有自动调整视口以显示完整路线。用户可能需要手动缩放/平移才能看到全貌。

**改进方案**：
- 在路线渲染完成（nativeOverlayResult.renderedCount > 0）后，调用 `map.setFitView()`
- 设置合理的 padding 避免路线贴边
- 参考 skill 文档 `references/view-control.md`
- 涉及文件：`src/components/itinerary/MapPanel.tsx`

#### 问题 9: 事件监听器未清理

**现状**：
- MapPanel.tsx 中 `map.on('click', ...)` 在组件卸载时未 off
- Explore.tsx 中 `marker.on('click', ...)` 在清理时未 off
- 可能导致内存泄漏

**改进方案**：
- 保存事件处理函数引用
- 在 cleanup 中调用 `map.off('click', handler)` 和 `marker.off('click', handler)`
- 参考 skill 文档 `references/events.md`
- 涉及文件：`src/components/itinerary/MapPanel.tsx`、`src/components/screens/Explore.tsx`

#### 问题 10: 缺少地图拖拽/缩放事件响应

**现状**：Explore.tsx 中地图没有监听 `moveend`/`zoomend` 事件，用户移动地图后无法自动刷新附近 POI。

**改进方案**：
- 在 Explore.tsx 中监听 `map.on('moveend', debouncedSearch)`
- 使用 debounce 避免频繁请求
- 移动后以新的中心点重新搜索附近 POI
- 参考 skill 文档 `references/events.md`
- 涉及文件：`src/components/screens/Explore.tsx`

#### 问题 11: 公交路线渲染器被禁用

**现状**：MapPanel.tsx:464-474 中公交模式下 `AMap.Transfer` 渲染器被主动清除，降级为 Polyline。这损失了换乘信息的可视化。

**改进方案**：
- 分析 Transfer 渲染器报错的具体原因
- 增加错误恢复逻辑，而非直接禁用
- 如果 Transfer 渲染器确实不可用，优化 Polyline 降级方案：用不同颜色区分步行段和乘车段
- 涉及文件：`src/components/itinerary/MapPanel.tsx`

---

### 🟢 P3: 进阶功能（可选增强）

#### 问题 12: 缺少 Geolocation 定位插件

**现状**：项目使用浏览器原生 `navigator.geolocation`，没有使用高德 `AMap.Geolocation` 插件。高德插件提供更精准的定位（结合 WiFi/基站/GPS）和 IP 定位降级。

**改进方案**：
- 引入 `AMap.Geolocation` 插件
- 使用 `AMap.CitySearch` 获取城市信息
- 参考 skill 文档 `references/api/geolocation.md`
- 涉及文件：`src/services/amapWeb.ts`、`src/services/apiAdapter.ts`

#### 问题 13: 缺少 AutoComplete 输入提示

**现状**：搜索框没有使用高德 `AMap.AutoComplete` 插件做实时输入提示。当前使用 REST API `searchInputTips`，但没有与地图联动。

**改进方案**：
- 在搜索框中集成 `AMap.AutoComplete`
- 监听 `select` 事件，选中后自动在地图上标记并定位
- 参考 skill 文档 `references/search.md`
- 涉及文件：`src/components/screens/Explore.tsx`、`src/components/screens/RestaurantFinder.tsx`

#### 问题 14: 缺少地图类型切换

**现状**：用户无法切换标准地图/卫星图/混合图。

**改进方案**：
- 添加 `AMap.MapType` 控件
- 允许用户在标准、卫星、混合视图之间切换
- 参考 skill 文档 `references/api/controls.md`
- 涉及文件：`src/components/itinerary/MapPanel.tsx`

#### 问题 15: 重复骑行路线函数

**现状**：`apiAdapter.ts` 中有两个骑行路线函数：
- `planBicycleRoute()` (L1000): 使用 `v4/direction/bicycling`
- 另一个骑行函数 (L722): 使用 `v4/direction/bicycle`

**改进方案**：
- 统一为一个骑行路线函数
- 确认哪个 API 端点是正确的（`bicycle` vs `bicycling`）
- 涉及文件：`src/services/apiAdapter.ts`

#### 问题 16: 缺少 MarkerCluster 聚合

**现状**：当 POI 数量较多时（如搜索结果），所有标记同时显示可能导致性能问题和视觉混乱。

**改进方案**：
- 在 Explore.tsx 中引入 `AMap.MarkerCluster` 插件
- 当标记数量超过阈值（如 50 个）时自动启用聚合
- 参考 skill 文档 `references/api/marker.md`
- 涉及文件：`src/components/screens/Explore.tsx`

---

## 三、实施优先级

| 优先级 | 问题编号 | 描述 | 影响范围 | 实施难度 |
|-------|---------|------|---------|---------|
| P0 | #1 | 移除硬编码 API Key | 安全 | 低 |
| P0 | #2 | 安全配置 serviceHost | 安全 | 低 |
| P1 | #3 | 添加 InfoWindow | 用户体验 | 中 |
| P1 | #4 | 添加 ControlBar | 3D 交互 | 低 |
| P1 | #5 | 添加 HawkEye | 导航体验 | 低 |
| P1 | #6 | 添加 3D Buildings | 视觉效果 | 低 |
| P1 | #7 | 地图 complete 事件 | 稳定性 | 低 |
| P2 | #8 | 路线 setFitView | 用户体验 | 低 |
| P2 | #9 | 事件监听器清理 | 内存管理 | 中 |
| P2 | #10 | 地图移动刷新 POI | 交互体验 | 中 |
| P2 | #11 | 公交路线渲染优化 | 用户体验 | 高 |
| P3 | #12 | Geolocation 插件 | 定位精度 | 中 |
| P3 | #13 | AutoComplete 输入提示 | 搜索体验 | 中 |
| P3 | #14 | 地图类型切换 | 功能丰富度 | 低 |
| P3 | #15 | 统一骑行路线函数 | 代码质量 | 低 |
| P3 | #16 | MarkerCluster 聚合 | 性能 | 中 |

---

## 四、涉及文件清单

| 文件 | 修改类型 | 涉及问题 |
|------|---------|---------|
| `src/services/apiAdapter.ts` | 修改 | #1, #15 |
| `src/services/poiImageService.ts` | 修改 | #1 |
| `src/services/amapWeb.ts` | 修改 | #2, #12 |
| `.env.example` | 修改 | #2 |
| `src/components/itinerary/MapPanel.tsx` | 修改 | #4, #5, #6, #7, #8, #9, #11, #14 |
| `src/components/screens/Explore.tsx` | 修改 | #3, #7, #9, #10, #13, #16 |

---

## 五、验证步骤

1. **TypeCheck**：`npx tsc --noEmit` 确认无新增类型错误
2. **安全检查**：确认源码中无硬编码 Key
3. **功能验证**：
   - 地图正常加载，3D 模式下 ControlBar 可用
   - 点击 POI 标记显示 InfoWindow
   - 路线渲染后自动 fitView
   - 组件卸载后无内存泄漏警告
4. **降级验证**：无 Key 时正常降级到 Mock 数据
