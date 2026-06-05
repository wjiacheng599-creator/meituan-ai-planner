/**
 * MultiDayTabs - 多日行程日期切换 Tab
 *
 * 支持两种模式：
 * 1. Plan.days 存在时 → 直接使用 days 数据
 * 2. Plan.days 不存在时 → 根据 activities 的 timeLine 自动分组
 */
import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import type { Plan, Activity } from '../../services/ai';

// ── 自动分组：从 activities 推断多日 ──

interface DayGroup {
  dayIndex: number;
  label: string;
  summary?: string;
  activities: Activity[];
  totalPrice: number;
}

function inferDayGroups(activities: Activity[]): DayGroup[] {
  // 尝试从 timeLine 中提取日期信息
  // 支持格式："Day1 14:00-16:00", "第一天 14:00", "5/19 14:00", "14:00-16:00"（单日）
  const dayMap = new Map<number, Activity[]>();
  let hasMultipleDays = false;

  for (const act of activities) {
    const tl = typeof act.timeLine === 'string' ? act.timeLine : '';
    let dayIndex = 1;

    // 匹配 "Day1", "Day 1", "第一天", "D1"
    const dayMatch = tl.match(/[Dd]ay\s*(\d+)|第(\d+)天|[Dd](\d+)/);
    if (dayMatch) {
      dayIndex = parseInt(dayMatch[1] || dayMatch[2] || dayMatch[3]);
      if (dayIndex > 1) {
        hasMultipleDays = true;
      }
    }
    // 匹配日期格式 "5/19", "05-19"
    else {
      const dateMatch = tl.match(/(\d{1,2})[\/\-](\d{1,2})/);
      if (dateMatch) {
        // 用月日组合作为 dayIndex
        dayIndex = parseInt(dateMatch[1]) * 100 + parseInt(dateMatch[2]);
        // 只要有明确日期格式，默认就是单日，除非有多个不同的日期
        // 这里先加入，如果后续有不同日期会标记
      }
    }

    if (!dayMap.has(dayIndex)) dayMap.set(dayIndex, []);
    dayMap.get(dayIndex)!.push(act);
  }

  // 再检查一次是否真的有多天
  // 如果只有一个dayIndex，或者虽然有多个但都是相同日期（例如都是0519），则视为单日
  if (dayMap.size <= 1) {
    return [
      {
        dayIndex: 1,
        label: '全天行程',
        activities,
        totalPrice: activities.reduce((sum, a) => sum + a.price, 0),
      },
    ];
  }

  // 检查是否所有的dayIndex其实属于同一天
  const days = Array.from(dayMap.keys()).sort((a, b) => a - b);
  // 如果只有一个分组，或者所有活动都没有明确的多天标记（没有 Day1/Day2/第一天/第二天），则视为单日
  const hasExplicitDayMark = activities.some((a) => {
    const tl = typeof a.timeLine === 'string' ? a.timeLine : '';
    return /[Dd]ay\s*\d|第\d+天|[Dd]\d/.test(tl);
  });
  const isSameDay = days.length <= 1 || !hasExplicitDayMark;
  if (isSameDay) {
    return [
      {
        dayIndex: 1,
        label: '全天行程',
        activities,
        totalPrice: activities.reduce((sum, a) => sum + a.price, 0),
      },
    ];
  }

  // 多天：排序并生成标签
  return days.map((dayIndex, i) => ({
    dayIndex,
    label: `第${i + 1}天`,
    summary: `${dayMap.get(dayIndex)!.length} 个活动`,
    activities: dayMap.get(dayIndex)!,
    totalPrice: dayMap.get(dayIndex)!.reduce((sum, a) => sum + a.price, 0),
  }));
}

// ── 组件 ──

interface MultiDayTabsProps {
  plan: Plan;
  activeDayIndex: number;
  onDayChange: (dayIndex: number) => void;
}

export default function MultiDayTabs({ plan, activeDayIndex, onDayChange }: MultiDayTabsProps) {
  const dayGroups = useMemo(() => {
    if (plan.days && plan.days.length > 0) {
      return plan.days.map((d) => ({
        dayIndex: d.dayIndex,
        label: d.label,
        summary: d.summary,
        activities: d.activities,
        totalPrice: d.totalPrice || d.activities.reduce((sum, a) => sum + a.price, 0),
      }));
    }
    return inferDayGroups(plan.activities);
  }, [plan]);

  // 单日不需要 Tab
  if (dayGroups.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none px-1 py-1">
      {dayGroups.map((day) => (
        <button
          key={day.dayIndex}
          onClick={() => onDayChange(day.dayIndex)}
          className={`relative flex flex-col items-center px-4 py-2 rounded-2xl text-[13px] font-bold transition-all active:scale-95 min-w-[80px] ${
            activeDayIndex === day.dayIndex
              ? 'bg-[var(--app-ink)] text-white shadow-md'
              : 'bg-white/80 text-[var(--app-text)] border border-[var(--app-border)]'
          }`}
        >
          <span className="text-[13px] font-bold">{day.label}</span>
          <span
            className={`text-[10px] font-medium mt-0.5 ${activeDayIndex === day.dayIndex ? 'text-white/70' : 'text-[var(--app-text-soft)]'}`}
          >
            {day.activities.length}个活动 · ¥{day.totalPrice}
          </span>
          {activeDayIndex === day.dayIndex && (
            <motion.div
              layoutId="activeDayTab"
              className="absolute inset-0 rounded-2xl bg-[var(--app-ink)] -z-10"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ── 导出工具函数供外部使用 ──

export function getActivitiesForDay(plan: Plan, dayIndex: number): Activity[] {
  if (plan.days && plan.days.length > 0) {
    const day = plan.days.find((d) => d.dayIndex === dayIndex);
    return day?.activities || [];
  }
  const groups = inferDayGroups(plan.activities);
  const group = groups.find((g) => g.dayIndex === dayIndex);
  return group?.activities || plan.activities;
}

export function getDayCount(plan: Plan): number {
  if (plan.days && plan.days.length > 0) return plan.days.length;
  const groups = inferDayGroups(plan.activities);
  return groups.length;
}
