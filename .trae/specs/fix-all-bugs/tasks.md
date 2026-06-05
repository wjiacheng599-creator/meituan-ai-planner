# Tasks

## 阶段一：关键页面修复（会导致页面崩溃）

- [ ] Task 1: 修复 MerchantDetail.tsx 空引用错误 (13处)
  - 文件: src/components/screens/MerchantDetail.tsx
  - 问题: activity 可能为 null，但代码未做空值检查
  - 步骤:
    1. 在使用 activity 前添加空值检查
    2. 如果 activity 为 null，显示加载状态或返回空状态
  - 验证: TypeScript 编译无 MerchantDetail 相关错误

- [ ] Task 2: 修复 Itinerary.tsx 解构 undefined 错误
  - 文件: src/components/screens/Itinerary.tsx (line 1839)
  - 问题: 访问 { map, result } 但对象可能为 undefined
  - 步骤:
    1. 添加可选链操作符或空值检查
    2. 提供默认值或安全退出
  - 验证: TypeScript 编译无 Itinerary 相关错误

## 阶段二：核心服务修复

- [ ] Task 3: 修复 routePlanning.ts 空引用错误 (8处)
  - 文件: src/services/routePlanning.ts
  - 问题: result.result.routes 可能为 undefined
  - 步骤:
    1. 在访问 routes 前添加空值检查
    2. 处理 segment.path 可能为 undefined 的情况
  - 验证: TypeScript 编译无 routePlanning 相关错误

## 阶段三：组件类型修复

- [ ] Task 4: 修复 App.tsx 类型错误 (2处)
  - 文件: src/App.tsx (lines 211, 296)
  - 问题: 参数类型不匹配
  - 步骤:
    1. 修复 line 211 的函数参数类型
    2. 修复 line 296 的 AppState 类型转换
  - 验证: TypeScript 编译无 App.tsx 相关错误

- [ ] Task 5: 修复 AppRouter.tsx 空值检查
  - 文件: src/components/AppRouter.tsx (line 298)
  - 问题: state.plan 可能为 null
  - 步骤:
    1. 添加空值检查
  - 验证: TypeScript 编译无 AppRouter 相关错误

- [ ] Task 6: 修复 Collaborate.tsx 类型不匹配
  - 文件: src/components/screens/Collaborate.tsx (line 256)
  - 问题: string 不能赋值给 { name: string }
  - 步骤:
    1. 将 string 转换为正确的对象格式
  - 验证: TypeScript 编译无 Collaborate 相关错误

- [ ] Task 7: 修复 Explore.tsx 类型兼容性问题
  - 文件: src/components/screens/Explore.tsx (line 381)
  - 问题: Post | null 不能赋值给 Post
  - 步骤:
    1. 过滤掉 null 值或提供默认值
  - 验证: TypeScript 编译无 Explore 相关错误

## 阶段四：UI 组件修复

- [ ] Task 8: 修复 Onboarding.tsx 条件判断错误
  - 文件: src/components/screens/Onboarding.tsx (line 342)
  - 问题: 函数始终返回 true
  - 步骤:
    1. 将函数引用改为函数调用
  - 验证: TypeScript 编译无 Onboarding 相关错误

- [ ] Task 9: 修复 RestaurantFinder.tsx 条件判断错误
  - 文件: src/components/screens/RestaurantFinder.tsx (line 364)
  - 问题: 函数始终返回 true
  - 步骤:
    1. 将函数引用改为函数调用
  - 验证: TypeScript 编译无 RestaurantFinder 相关错误

- [ ] Task 10: 修复 Overview.tsx 类型谓词错误
  - 文件: src/components/screens/Overview.tsx (line 132)
  - 问题: polyline 属性在类型中是可选的
  - 步骤:
    1. 调整类型谓词定义
  - 验证: TypeScript 编译无 Overview 相关错误

- [ ] Task 11: 修复 RouteGuideCard.tsx undefined 访问
  - 文件: src/components/itinerary/RouteGuideCard.tsx (line 106)
  - 问题: segment.path 可能为 undefined
  - 步骤:
    1. 添加空值检查
  - 验证: TypeScript 编译无 RouteGuideCard 相关错误

## 阶段五：验证

- [ ] Task 12: 运行 TypeScript 编译验证
  - 步骤:
    1. 运行 npx tsc --noEmit
    2. 确认错误数量为 0
  - 验证: 无 TypeScript 错误

# Task Dependencies
- Task 12 依赖于 Task 1-11 全部完成
