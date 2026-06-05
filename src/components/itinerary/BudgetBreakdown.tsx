import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingDown, TrendingUp, Wallet, PieChart } from 'lucide-react';
import type { Activity } from '../../services/ai/types';

export interface BudgetBreakdownProps {
  activities: Activity[];
  totalBudget?: number;
  compact?: boolean;
  showLegend?: boolean;
}

interface CategoryBudget {
  type: string;
  amount: number;
  percentage: number;
  count: number;
}

const TYPE_LABELS: Record<string, string> = {
  food: '餐饮',
  activity: '活动',
  travel: '交通',
  shopping: '购物',
  lodging: '住宿',
};

const TYPE_COLORS: Record<string, string> = {
  food: 'var(--brand)',
  activity: 'var(--sky-ink)',
  travel: 'var(--mint-ink)',
  shopping: 'var(--rose-ink)',
  lodging: 'var(--peach-ink)',
};

const TYPE_BG_COLORS: Record<string, string> = {
  food: 'rgba(255, 200, 58, 0.15)',
  activity: 'rgba(59, 130, 246, 0.15)',
  travel: 'rgba(16, 185, 129, 0.15)',
  shopping: 'rgba(244, 63, 94, 0.15)',
  lodging: 'rgba(249, 115, 22, 0.15)',
};

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `¥${(amount / 1000).toFixed(1)}k`;
  }
  return `¥${amount}`;
}

function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

export default function BudgetBreakdown({
  activities,
  totalBudget,
  compact = false,
  showLegend = true,
}: BudgetBreakdownProps) {
  const [activeType, setActiveType] = useState<string | null>(null);

  const breakdown = useMemo(() => {
    const categories: Record<string, { amount: number; count: number }> = {};

    for (const activity of activities) {
      const type = activity.type || 'activity';
      if (!categories[type]) {
        categories[type] = { amount: 0, count: 0 };
      }
      categories[type].amount += activity.price || 0;
      categories[type].count += 1;
    }

    const total = Object.values(categories).reduce((sum, cat) => sum + cat.amount, 0);

    const result: CategoryBudget[] = Object.entries(categories)
      .filter(([, data]) => data.amount > 0)
      .map(([type, data]) => ({
        type,
        amount: data.amount,
        count: data.count,
        percentage: total > 0 ? (data.amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return result;
  }, [activities]);

  const totalSpent = useMemo(() => {
    return breakdown.reduce((sum, cat) => sum + cat.amount, 0);
  }, [breakdown]);

  const remaining = useMemo(() => {
    return totalBudget ? totalBudget - totalSpent : undefined;
  }, [totalBudget, totalSpent]);

  const budgetPercentage = useMemo(() => {
    if (!totalBudget || totalBudget === 0) return 0;
    return Math.min((totalSpent / totalBudget) * 100, 100);
  }, [totalBudget, totalSpent]);

  const isOverBudget = remaining !== undefined && remaining < 0;

  if (breakdown.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveType(null)}>
        <div className="flex gap-0.5 flex-1">
          {breakdown.slice(0, 4).map((cat) => (
            <motion.div
              key={cat.type}
              className="h-2 rounded-full"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3 }}
              style={{
                width: `${Math.max(cat.percentage, 5)}%`,
                backgroundColor: TYPE_COLORS[cat.type] || '#999',
              }}
              title={`${TYPE_LABELS[cat.type]}: ¥${cat.amount}`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-500 font-medium">{formatCurrency(totalSpent)}</span>
      </div>
    );
  }

  return (
    <motion.div
      className="app-panel rounded-2xl p-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-[var(--brand-soft)] flex items-center justify-center">
          <PieChart className="w-4 h-4 text-[var(--brand-ink)]" />
        </div>
        <span className="text-[13px] font-bold text-gray-900">预算概览</span>
      </div>

      {/* Summary Section */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl p-4 mb-4">
        <div className="flex items-end justify-between mb-3">
          <div>
            <span className="text-[11px] text-gray-500 font-medium">总花费</span>
            <div className="text-[28px] font-bold text-gray-900 leading-none mt-0.5">
              ¥{formatNumber(totalSpent)}
            </div>
          </div>
          {totalBudget && remaining !== undefined && (
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                isOverBudget ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}
            >
              {isOverBudget ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {isOverBudget
                ? `超¥${formatNumber(Math.abs(remaining))}`
                : `剩¥${formatNumber(remaining)}`}
            </div>
          )}
        </div>

        {/* Budget Progress Bar */}
        {totalBudget && (
          <div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
              <span>预算使用</span>
              <span className="font-medium">{budgetPercentage.toFixed(0)}%</span>
            </div>
            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isOverBudget ? 'bg-red-400' : 'bg-[var(--brand)]'}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
              <span>¥0</span>
              <span className="font-medium">¥{formatNumber(totalBudget)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Chart & List Section */}
      <div className="flex items-start gap-4">
        {/* Donut Chart */}
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
            {/* Background circle */}
            <circle
              cx="21"
              cy="21"
              r="15.9155"
              fill="transparent"
              stroke="#E5E7EB"
              strokeWidth="4"
            />
            {/* Data circles */}
            {breakdown.map((cat, index) => {
              const offset = breakdown.slice(0, index).reduce((sum, c) => sum + c.percentage, 0);
              const isActive = activeType === cat.type;
              return (
                <motion.circle
                  key={cat.type}
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="transparent"
                  stroke={TYPE_COLORS[cat.type] || '#999'}
                  strokeWidth={isActive ? '5' : '4'}
                  strokeDasharray={`${cat.percentage} ${100 - cat.percentage}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => setActiveType(isActive ? null : cat.type)}
                />
              );
            })}
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-400">占比</span>
            <span className="text-[15px] font-bold text-gray-900">
              {activeType
                ? `${breakdown.find((c) => c.type === activeType)?.percentage.toFixed(0) || 0}%`
                : '100%'}
            </span>
          </div>
        </div>

        {/* Category List */}
        <div className="flex-1 space-y-2">
          <AnimatePresence mode="wait">
            {breakdown.map((cat) => {
              const isActive = activeType === cat.type;
              return (
                <motion.div
                  key={cat.type}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    backgroundColor: isActive
                      ? TYPE_BG_COLORS[cat.type] || 'transparent'
                      : 'transparent',
                  }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-200 active:scale-[0.98] ${
                    isActive ? '' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveType(isActive ? null : cat.type)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[cat.type] || '#999' }}
                    />
                    <span
                      className={`text-[13px] font-medium ${
                        isActive ? 'text-gray-900' : 'text-gray-600'
                      }`}
                    >
                      {TYPE_LABELS[cat.type] || cat.type}
                    </span>
                    <span className="text-[11px] text-gray-400">×{cat.count}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[13px] font-semibold ${
                        isActive ? 'text-gray-900' : 'text-gray-700'
                      }`}
                    >
                      ¥{formatNumber(cat.amount)}
                    </span>
                    <span className="text-[11px] text-gray-400 w-8 text-right">
                      {cat.percentage.toFixed(0)}%
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Total */}
          <div className="border-t border-gray-200 pt-2 mt-2">
            <div className="flex items-center justify-between px-2">
              <span className="text-[13px] font-semibold text-gray-700">总计</span>
              <span className="text-[15px] font-bold text-gray-900">
                ¥{formatNumber(totalSpent)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setActiveType(activeType === type ? null : type)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-all duration-200 active:scale-95 ${
                  activeType === type
                    ? 'bg-gray-100 text-gray-700'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[type] || '#999' }}
                />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function MiniBudgetBadge({ activities }: { activities: Activity[] }) {
  const total = useMemo(() => {
    return activities.reduce((sum, a) => sum + (a.price || 0), 0);
  }, [activities]);

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--brand-soft)] rounded-xl">
      <Wallet className="w-3.5 h-3.5 text-[var(--brand-ink)]" />
      <span className="text-[13px] font-semibold text-[var(--brand-ink)]">
        ¥{formatNumber(total)}
      </span>
    </div>
  );
}
