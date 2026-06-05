# 修复经济版行程质量问题：同品牌重复 + 点位分散

## 问题描述

经济版行程生成了两个麦当劳（北京新街口店 和 石景山店），且两点距离很远，行程不合理。

## 根因分析

经过代码探索，定位到 **4 个根因**：

### 根因 1：候选 POI 无品牌去重

[candidateSearch.ts:197-204](src/services/ai/candidateSearch.ts#L197-L204) 的 `deduplicatePOIs` 仅按 `poi.name` 精确去重。"麦当劳(北京新街口店)" 和 "麦当劳(石景山店)" 名称不同，都被保留并注入 LLM prompt。LLM 从候选列表中选了两个麦当劳。

### 根因 2：budgetOptions 无路线优化

[planGenerator.ts:459-466](src/services/ai/planGenerator.ts#L459-L466) 的路线优化（nearestNeighbor + twoOpt）和约束求解**只作用于 `plan.activities`**，不作用于 `budgetOptions[].activities`。经济版的活动列表完全由 LLM 自由生成，没有任何地理聚类约束。

### 根因 3：Prompt 无经济版地理约束

[planGenerator.ts:388-396](src/services/ai/planGenerator.ts#L388-L396) 的 budgetOptions prompt 只说"选择免费/低价场所"，没有要求：
- 同一版本的活动应地理聚类（减少交通时间）
- 避免同品牌重复门店
- 经济版也应遵循路线合理性

### 根因 4：POI 搜索半径过大且无聚类

[candidateSearch.ts:132](src/services/ai/candidateSearch.ts#L132) 搜索半径 5000m，多次搜索（不同关键词）的结果可能来自城市不同区域。候选列表中可能同时包含东边和西边的同品牌门店。

## 解决方案（4 层防御）

### 第 1 层：品牌级去重（候选搜索阶段）

**文件**: `src/services/ai/candidateSearch.ts`

**修改**: 增强 `deduplicatePOIs` 函数，新增品牌提取和同品牌去重逻辑：
- 提取品牌名：从 POI 名称中提取括号前的品牌名（如"麦当劳(北京新街口店)" → "麦当劳"）
- 同品牌只保留 1 个：优先保留距离更近的（如有 distance 字段）或评分更高的
- 这样 LLM 的候选列表中不会出现两个麦当劳

**具体实现**:
```typescript
function extractBrand(name: string): string {
  // 提取括号前的品牌名，如 "麦当劳(北京新街口店)" → "麦当劳"
  // 也处理 "肯德基(望京SOHO店)" → "肯德基"
  const match = name.match(/^([^(（]+)/);
  return match ? match[1].trim() : name;
}

function deduplicatePOIs(pois) {
  const seen = new Set<string>();
  const brandSeen = new Set<string>();
  return pois.filter(poi => {
    // 精确名称去重
    if (seen.has(poi.name)) return false;
    seen.add(poi.name);
    
    // 品牌去重：同品牌只保留第一个（已按距离/评分排序）
    const brand = extractBrand(poi.name);
    if (brand.length >= 2 && brandSeen.has(brand)) return false;
    brandSeen.add(brand);
    
    return true;
  });
}
```

### 第 2 层：Prompt 增加经济版地理约束

**文件**: `src/services/ai/planGenerator.ts`

**修改位置**: 第 388-396 行的 budgetOptions prompt 部分

**新增规则**:
```
- 经济版活动必须地理集中：所有活动之间直线距离不超过 3km，优先选择同一商圈/区域内的场所
- 同一版本中禁止出现同品牌的不同门店（如不能同时安排两个麦当劳、两个星巴克）
- 经济版的餐饮应选择不同类型（如一个快餐+一个小吃街，而非两个快餐）
```

### 第 3 层：budgetOptions 路线优化

**文件**: `src/services/ai/planGenerator.ts`

**修改位置**: 第 459-466 行之后，增加对 budgetOptions 的路线优化

**逻辑**: 遍历 `plan.budgetOptions`，对每个版本的 `activities` 调用 `optimizeActivitiesWithConstraints`（如果活动有经纬度的话），或者至少做距离检查和顺序重排。

```typescript
// 对 budgetOptions 也做路线优化
if (Array.isArray(plan.budgetOptions)) {
  for (const option of plan.budgetOptions) {
    if (Array.isArray(option.activities) && option.activities.length > 1) {
      // 为活动补充经纬度（如果缺失）
      const enriched = await enrichActivitiesWithCoords(option.activities, userCity);
      if (enriched.some(a => a.lat && a.lng)) {
        const optimized = optimizeActivitiesWithConstraints(enriched, {
          strategy: 'nearest',
          applyTimeConstraints: true,
          applyTypeConstraints: true,
        });
        option.activities = optimized.optimizedActivities;
      }
    }
  }
}
```

### 第 4 层：生成后校验

**文件**: `src/services/ai/planValidator.ts`

**新增校验函数** `validateBudgetOptions`:
- 检查每个 budgetOption 中是否有同品牌重复（复用 extractBrand 逻辑）
- 检查活动间距离是否合理（如有经纬度，计算最大间距）
- 发现问题时记录 warning 并尝试自动修正（移除重复品牌、重排顺序）

## 修改文件清单

| 文件 | 修改内容 | 改动量 |
|------|----------|--------|
| `src/services/ai/candidateSearch.ts` | 增强 deduplicatePOIs，新增品牌去重 | ~15 行 |
| `src/services/ai/planGenerator.ts` | 1) Prompt 增加经济版地理约束 2) budgetOptions 路线优化 | ~30 行 |
| `src/services/ai/planValidator.ts` | 新增 validateBudgetOptions 校验函数 | ~40 行 |

## 验证步骤

1. 运行 TypeScript 编译检查 `npx tsc --noEmit`
2. 搜索"北京周末去哪玩"，检查经济版行程：
   - 不应出现同品牌重复门店
   - 活动间距离应合理（不超过 3km）
   - 餐饮类型应有差异
3. 检查标准版和品质版不受影响
