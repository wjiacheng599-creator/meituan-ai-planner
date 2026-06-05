# 全面 Bug 修复 Spec

## Why
项目存在 35 个 TypeScript 编译错误和多个运行时 bug，导致页面崩溃、功能失效。需要系统性修复以确保应用稳定运行。

## What Changes
- 修复 MerchantDetail 页面 13 处空引用错误
- 修复 routePlanning.ts 中 8 处空引用错误
- 修复 Itinerary.tsx 中解构 undefined 对象的问题
- 修复 App.tsx 中的类型错误
- 修复 AppRouter.tsx 中的空值检查
- 修复 Collaborate.tsx 中的类型不匹配
- 修复 Explore.tsx 中的类型兼容性问题
- 修复 Onboarding.tsx 和 RestaurantFinder.tsx 中的条件判断错误
- 修复 Overview.tsx 中的类型谓词错误
- 修复 RouteGuideCard.tsx 中的 undefined 访问
- 修复 MapPanel.tsx 中的 AMap 集成问题

## Impact
- Affected specs: 所有页面和核心功能
- Affected code: 12 个文件

## MODIFIED Requirements
### Requirement: TypeScript 类型安全
所有代码必须通过 TypeScript 编译，无类型错误。

### Requirement: 空值安全
所有可能为 null/undefined 的值必须在使用前进行检查。

## ADDED Requirements
### Requirement: 运行时错误处理
关键操作必须有 try-catch 保护，避免页面崩溃。
