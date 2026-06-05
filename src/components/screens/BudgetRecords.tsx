import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  Wallet,
  PieChart,
  List,
  TrendingUp,
  TrendingDown,
  Utensils,
  MapPin,
  Car,
  ShoppingBag,
  Hotel,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  ChevronDown,
  X,
} from 'lucide-react';
import type { Plan } from '../../services/ai';

interface BudgetRecordsProps {
  savedPlans: Plan[];
  onBack: () => void;
}

type ViewMode = 'total' | 'byTrip';

const TYPE_CONFIG = {
  food: { label: '餐饮', icon: Utensils, color: '#FF9F43', bgColor: '#FFF5EB' },
  activity: { label: '活动', icon: Activity, color: '#3B82F6', bgColor: '#EFF6FF' },
  travel: { label: '交通', icon: Car, color: '#10B981', bgColor: '#ECFDF5' },
  shopping: { label: '购物', icon: ShoppingBag, color: '#F43F5E', bgColor: '#FFF1F2' },
  lodging: { label: '住宿', icon: Hotel, color: '#8B5CF6', bgColor: '#F5F3FF' },
};

function WaffleChart({
  percentage,
  color,
  size = 24,
}: {
  percentage: number;
  color: string;
  size?: number;
}) {
  const cells = 10;
  const filledCells = Math.round((percentage / 100) * cells);

  return (
    <div className="grid grid-cols-10 gap-0.5" style={{ width: size * 2, height: size }}>
      {Array.from({ length: cells }).map((_, i) => (
        <div
          key={i}
          className="rounded-[2px] transition-colors duration-300"
          style={{
            backgroundColor: i < filledCells ? color : `${color}20`,
          }}
        />
      ))}
    </div>
  );
}

function CategoryCard({
  type,
  amount,
  percentage,
  count,
  isExpanded,
  onToggle,
}: {
  type: string;
  amount: number;
  percentage: number;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.activity;
  const Icon = config.icon;

  return (
    <motion.button
      onClick={onToggle}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full p-4 rounded-[24px] border transition-all cursor-pointer active:scale-[0.98] ${
        isExpanded
          ? 'bg-white border-[var(--brand)]/30 shadow-[0_4px_18px_rgba(0,0,0,0.03)]'
          : 'bg-white border-[var(--app-border)] hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-[24px] bg-white border border-[var(--app-border)] flex items-center justify-center shrink-0 shadow-sm">
          <Icon className="w-6 h-6" style={{ color: config.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-[var(--app-ink)]">{config.label}</span>
              <span className="text-[11px] font-bold text-[var(--app-text)]">×{count}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-[var(--app-ink)]">
                ¥{amount.toLocaleString('zh-CN')}
              </span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: config.bgColor, color: config.color }}
              >
                {percentage.toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="h-2 bg-[var(--app-card-soft)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ backgroundColor: config.color }}
            />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function TotalBudgetCard({
  totalSpent,
  planCount,
  avgPerTrip,
}: {
  totalSpent: number;
  planCount: number;
  avgPerTrip: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[24px] border border-[var(--brand)]/20 bg-[linear-gradient(135deg,#FFF7FB_0%,#FFE7F1_40%,#FFE7B8_100%)] p-6 shadow-[0_16px_34px_rgba(255,126,185,0.16)]"
    >
      <div className="absolute -right-10 -top-8 h-28 w-28 rounded-full bg-white/40 blur-3xl" />
      <div className="absolute left-[-18px] bottom-[-16px] h-24 w-24 rounded-full bg-[#FFB347]/18 blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-14 w-14 rounded-[24px] bg-white/82 p-1.5 shadow-[0_10px_22px_rgba(255,255,255,0.46)] backdrop-blur shrink-0">
            <div className="w-full h-full rounded-[24px] bg-white flex items-center justify-center overflow-hidden border-2 border-white">
              <Wallet className="w-6 h-6 text-[#C94B86]" />
            </div>
          </div>
          <div>
            <div className="text-[13px] font-bold text-[#7D4B3E]">累计总支出</div>
            <div className="text-[11px] font-bold text-[#7D4B3E]/70">共 {planCount} 个行程</div>
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-5">
          <span className="text-[13px] font-bold text-[#7D4B3E]">¥</span>
          <span className="text-[36px] font-bold text-[#25130E] tracking-tight">
            {totalSpent.toLocaleString('zh-CN')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/82 rounded-[24px] p-3 backdrop-blur border border-white/70 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-[#C94B86]" />
              <span className="text-[10px] font-bold text-[#7D4B3E]">平均每行程</span>
            </div>
            <div className="text-[15px] font-bold text-[#25130E]">
              ¥{avgPerTrip.toLocaleString('zh-CN')}
            </div>
          </div>
          <div className="bg-white/82 rounded-[24px] p-3 backdrop-blur border border-white/70 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-[#FFB347]" />
              <span className="text-[10px] font-bold text-[#7D4B3E]">最高单笔</span>
            </div>
            <div className="text-[15px] font-bold text-[#25130E]">
              ¥{(totalSpent * 0.4).toLocaleString('zh-CN')}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TripCard({
  plan,
  isSelected,
  onToggle,
}: {
  plan: Plan;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const activitiesByType = useMemo(() => {
    const grouped: Record<
      string,
      { count: number; amount: number; activities: typeof plan.activities }
    > = {};
    plan.activities.forEach((activity) => {
      const type = activity.type || 'activity';
      if (!grouped[type]) grouped[type] = { count: 0, amount: 0, activities: [] };
      grouped[type].count++;
      grouped[type].amount += activity.price || 0;
      grouped[type].activities.push(activity);
    });
    return grouped;
  }, [plan.activities]);

  const maxType = useMemo(() => {
    let maxAmount = 0;
    let maxTypeName = 'activity';
    Object.entries(activitiesByType).forEach(([type, data]) => {
      if (data.amount > maxAmount) {
        maxAmount = data.amount;
        maxTypeName = type;
      }
    });
    return maxTypeName;
  }, [activitiesByType]);

  const config = TYPE_CONFIG[maxType as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.activity;

  const dateRange = useMemo(() => {
    if (plan.days && plan.days.length > 0) {
      const dates = plan.days
        .filter((d) => d.date)
        .map((d) => d.date!)
        .sort();
      if (dates.length > 0) {
        const first = new Date(dates[0]);
        const last = new Date(dates[dates.length - 1]);
        const formatDate = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
        return `${formatDate(first)}-${formatDate(last)}`;
      }
    }
    if (plan.date) {
      const d = new Date(plan.date);
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    }
    return plan.durationTags || '';
  }, [plan]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-[24px] bg-white border border-[var(--app-border)] shadow-[0_4px_24px_rgba(0,0,0,0.03)]"
    >
      <button
        onClick={onToggle}
        className="w-full p-5 text-left active:scale-[0.99] transition-transform"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-bold text-[var(--app-ink)] line-clamp-2 mb-2">
              {plan.title}
            </h3>
            <div className="flex flex-wrap gap-2">
              {dateRange && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#0ea5e9]/10 px-3 py-1 text-[10px] font-bold text-[#0ea5e9]">
                  <MapPin className="w-3 h-3" />
                  {dateRange}
                </span>
              )}
              {plan.city && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-card-soft)] px-3 py-1 text-[10px] font-bold text-[var(--app-text)]">
                  {plan.city}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-card-soft)] px-3 py-1 text-[10px] font-bold text-[var(--app-text)]">
                {plan.activities.length} 个活动
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {plan.totalPrice !== undefined && (
              <div className="text-right">
                <div className="text-[22px] font-bold text-[var(--app-ink)]">
                  ¥{plan.totalPrice.toLocaleString('zh-CN')}
                </div>
                <div className="text-[11px] font-bold text-[var(--app-text)]">总预算</div>
              </div>
            )}
            <motion.div
              animate={{ rotate: isSelected ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              className="w-8 h-8 rounded-full bg-[var(--app-card-soft)] flex items-center justify-center"
            >
              <ChevronLeft
                className={`w-4 h-4 ${isSelected ? 'text-[var(--brand)]' : 'text-[var(--app-text)]'}`}
              />
            </motion.div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-[var(--app-border)]"
          >
            <div className="p-5 space-y-4">
              {/* 分类汇总卡片 */}
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(activitiesByType).map(([type, data]) => {
                  const typeConfig =
                    TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.activity;
                  const TypeIcon = typeConfig.icon;
                  const percentage = plan.totalPrice ? (data.amount / plan.totalPrice) * 100 : 0;

                  return (
                    <div
                      key={type}
                      className="rounded-[24px] p-3 border border-[var(--app-border)]"
                      style={{ backgroundColor: typeConfig.bgColor }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center">
                          <TypeIcon className="w-4 h-4" style={{ color: typeConfig.color }} />
                        </div>
                        <div>
                          <div className="text-[13px] font-bold text-[var(--app-ink)]">
                            {typeConfig.label}
                          </div>
                          <div className="text-[10px] font-bold text-[var(--app-text)]">
                            {data.count} 项
                          </div>
                        </div>
                      </div>
                      <div className="text-[15px] font-bold text-[var(--app-ink)]">
                        ¥{data.amount.toLocaleString('zh-CN')}
                      </div>
                      <div className="mt-1 h-1.5 bg-white/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${percentage}%`, backgroundColor: typeConfig.color }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] font-bold text-[var(--app-text)]">
                        {percentage.toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 活动详细列表 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[13px] font-bold text-[var(--app-ink)]">活动明细</div>
                </div>
                <div className="space-y-2">
                  {plan.activities.map((activity, index) => {
                    const actConfig =
                      TYPE_CONFIG[activity.type as keyof typeof TYPE_CONFIG] ||
                      TYPE_CONFIG.activity;
                    const ActIcon = actConfig.icon;
                    return (
                      <div
                        key={activity.id || index}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--app-card-soft)] border border-[var(--app-border)]"
                      >
                        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 border border-[var(--app-border)]">
                          <ActIcon className="w-5 h-5" style={{ color: actConfig.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold text-[var(--app-ink)] truncate">
                            {activity.title}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{ backgroundColor: actConfig.bgColor, color: actConfig.color }}
                            >
                              {actConfig.label}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[15px] font-bold text-[var(--app-ink)]">
                            ¥{(activity.price || 0).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 预算进度 */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-[24px] p-4 border border-[var(--app-border)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[var(--brand-soft)] flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-[var(--brand-ink)]" />
                    </div>
                    <span className="text-[13px] font-bold text-[var(--app-ink)]">
                      预算使用进度
                    </span>
                  </div>
                  <span className="text-[13px] font-bold text-[var(--app-ink)]">100%</span>
                </div>
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[var(--brand)] to-[#FFB347] rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// 筛选面板组件
function FilterPanel({
  visible,
  onClose,
  onApply,
  onReset,
  filters,
  setFilters,
  availableOptions,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  filters: any;
  setFilters: (filters: any) => void;
  availableOptions: {
    months: string[];
    cities: string[];
    dayCounts: number[];
    primaryTypes: string[];
  };
}) {
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return `${parseInt(month)}月`;
  };

  const renderFilterSection = (
    title: string,
    options: any[],
    key: string,
    formatFn?: (v: any) => string
  ) => {
    return (
      <div className="space-y-2">
        <div className="text-[13px] font-bold text-[var(--app-ink)]">{title}</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilters({ ...filters, [key]: 'all' })}
            className={`px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all ${
              filters[key] === 'all'
                ? 'bg-[var(--brand)] text-white'
                : 'bg-[var(--app-card-soft)] text-[var(--app-text)] hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          {options.map((option) => (
            <button
              key={option}
              onClick={() => setFilters({ ...filters, [key]: option })}
              className={`px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all ${
                filters[key] === option
                  ? 'bg-[var(--brand)] text-white'
                  : 'bg-[var(--app-card-soft)] text-[var(--app-text)] hover:bg-gray-200'
              }`}
            >
              {formatFn ? formatFn(option) : option}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* 遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-40"
          />

          {/* 底部面板 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[28px] z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
          >
            {/* 顶部指示条 */}
            <div className="flex justify-center pt-2.5 pb-1.5">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
            </div>

            {/* 标题栏 */}
            <div className="flex items-center justify-between px-5 pb-2">
              <div className="text-[15px] font-bold text-[var(--app-ink)]">筛选</div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center">
                <X className="w-5 h-5 text-[var(--app-text-soft)]" />
              </button>
            </div>

            {/* 筛选内容 */}
            <div
              className="overflow-y-auto px-5 pb-2 space-y-4"
              style={{ maxHeight: 'calc(100vh - 280px)' }}
            >
              {/* 月份 */}
              {availableOptions.months.length > 0 &&
                renderFilterSection('月份', availableOptions.months, 'month', formatMonth)}

              {/* 预算 */}
              {renderFilterSection(
                '预算',
                [
                  { value: 'low', label: '¥500以下' },
                  { value: 'medium', label: '¥500-1500' },
                  { value: 'high', label: '¥1500以上' },
                ],
                'budget',
                (v: any) => v.label
              )}

              {/* 城市 */}
              {availableOptions.cities.length > 0 &&
                renderFilterSection('城市', availableOptions.cities, 'city')}

              {/* 天数 */}
              {availableOptions.dayCounts.length > 0 &&
                renderFilterSection(
                  '天数',
                  availableOptions.dayCounts,
                  'days',
                  (v: number) => `${v}天`
                )}

              {/* 主要类型 */}
              {availableOptions.primaryTypes.length > 0 &&
                renderFilterSection(
                  '主要活动类型',
                  availableOptions.primaryTypes,
                  'primaryType',
                  (v: string) => TYPE_CONFIG[v as keyof typeof TYPE_CONFIG]?.label || v
                )}
            </div>

            {/* 底部按钮 */}
            <div className="sticky bottom-0 bg-white px-5 pb-5 pt-3 border-t border-[var(--app-border)] flex gap-3">
              <button
                onClick={onReset}
                className="flex-1 py-3 rounded-2xl bg-[var(--app-card-soft)] text-[13px] font-bold text-[var(--app-ink)] active:scale-[0.98] transition-transform"
              >
                重置
              </button>
              <button
                onClick={onApply}
                className="flex-1 py-3 rounded-2xl bg-[var(--brand)] text-[13px] font-bold text-white active:scale-[0.98] transition-transform"
              >
                确定
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function BudgetRecords({ savedPlans, onBack }: BudgetRecordsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('total');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 筛选状态
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [tempFilters, setTempFilters] = useState({
    month: 'all',
    budget: 'all',
    city: 'all',
    days: 'all',
    primaryType: 'all',
  });
  const [activeFilters, setActiveFilters] = useState({
    month: 'all',
    budget: 'all',
    city: 'all',
    days: 'all',
    primaryType: 'all',
  });

  // 提取所有可用的筛选选项
  const availableOptions = useMemo(() => {
    const months = new Set<string>();
    const cities = new Set<string>();
    const dayCounts = new Set<number>();
    const primaryTypes = new Set<string>();

    savedPlans.forEach((plan) => {
      // 提取月份
      if (plan.date) {
        const d = new Date(plan.date);
        months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      if (plan.days) {
        plan.days.forEach((day) => {
          if (day.date) {
            const d = new Date(day.date);
            months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          }
        });
      }

      // 提取城市（自动去重）
      if (plan.city) cities.add(plan.city);

      // 提取天数
      if (plan.days) dayCounts.add(plan.days.length);

      // 提取主要类型
      const typeCounts: Record<string, number> = {};
      plan.activities.forEach((act) => {
        const type = act.type || 'activity';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
      let maxCount = 0;
      let primaryType = 'activity';
      Object.entries(typeCounts).forEach(([type, count]) => {
        if (count > maxCount) {
          maxCount = count;
          primaryType = type;
        }
      });
      primaryTypes.add(primaryType);
    });

    return {
      months: Array.from(months).sort().reverse(),
      cities: Array.from(new Set(cities)).sort(),
      dayCounts: Array.from(dayCounts).sort((a, b) => a - b),
      primaryTypes: Array.from(primaryTypes),
    };
  }, [savedPlans]);

  const filteredPlans = useMemo(() => {
    let filtered = savedPlans;

    // 月份筛选
    if (activeFilters.month !== 'all') {
      filtered = filtered.filter((plan) => {
        const hasMonth = (date?: string) => {
          if (!date) return false;
          const d = new Date(date);
          return (
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` ===
            activeFilters.month
          );
        };
        if (hasMonth(plan.date)) return true;
        if (plan.days?.some((d) => hasMonth(d.date))) return true;
        return false;
      });
    }

    // 预算筛选
    if (activeFilters.budget !== 'all') {
      filtered = filtered.filter((plan) => {
        const price = plan.totalPrice || 0;
        switch (activeFilters.budget) {
          case 'low':
            return price < 500;
          case 'medium':
            return price >= 500 && price < 1500;
          case 'high':
            return price >= 1500;
          default:
            return true;
        }
      });
    }

    // 城市筛选
    if (activeFilters.city !== 'all') {
      filtered = filtered.filter((plan) => plan.city === activeFilters.city);
    }

    // 天数筛选
    if (activeFilters.days !== 'all') {
      const daysNum = parseInt(activeFilters.days);
      filtered = filtered.filter((plan) => (plan.days?.length || 0) === daysNum);
    }

    // 主要类型筛选
    if (activeFilters.primaryType !== 'all') {
      filtered = filtered.filter((plan) => {
        const typeCounts: Record<string, number> = {};
        plan.activities.forEach((act) => {
          const type = act.type || 'activity';
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        let maxCount = 0;
        let primaryType = 'activity';
        Object.entries(typeCounts).forEach(([type, count]) => {
          if (count > maxCount) {
            maxCount = count;
            primaryType = type;
          }
        });
        return primaryType === activeFilters.primaryType;
      });
    }

    return filtered;
  }, [savedPlans, activeFilters]);

  const hasActiveFilters = Object.values(activeFilters).some((v) => v !== 'all');

  const applyFilters = () => {
    setActiveFilters({ ...tempFilters });
    setShowFilterPanel(false);
  };

  const resetFilters = () => {
    const reset = {
      month: 'all',
      budget: 'all',
      city: 'all',
      days: 'all',
      primaryType: 'all',
    };
    setTempFilters(reset);
    setActiveFilters(reset);
    setShowFilterPanel(false);
  };

  const openFilterPanel = () => {
    setTempFilters({ ...activeFilters });
    setShowFilterPanel(true);
  };

  const totalBudgetStats = useMemo(() => {
    const plansWithBudget = savedPlans.filter((plan) => plan.totalPrice !== undefined);
    const totalSpent = plansWithBudget.reduce((sum, plan) => sum + (plan.totalPrice || 0), 0);

    const categoryTotals: Record<string, { amount: number; count: number }> = {};
    plansWithBudget.forEach((plan) => {
      plan.activities.forEach((activity) => {
        const type = activity.type || 'activity';
        if (!categoryTotals[type]) categoryTotals[type] = { amount: 0, count: 0 };
        categoryTotals[type].amount += activity.price || 0;
        categoryTotals[type].count++;
      });
    });

    return {
      planCount: plansWithBudget.length,
      totalSpent,
      avgPerTrip: plansWithBudget.length > 0 ? Math.round(totalSpent / plansWithBudget.length) : 0,
      categoryTotals,
    };
  }, [savedPlans]);

  const sortedCategories = useMemo(() => {
    return Object.entries(totalBudgetStats.categoryTotals)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .map(([type, data]) => ({
        type,
        ...data,
        percentage:
          totalBudgetStats.totalSpent > 0 ? (data.amount / totalBudgetStats.totalSpent) * 100 : 0,
      }));
  }, [totalBudgetStats]);

  // 获取当前筛选的标签
  const activeFilterTags = useMemo(() => {
    const tags: { label: string; key: string }[] = [];

    if (activeFilters.month !== 'all') {
      const [year, month] = activeFilters.month.split('-');
      tags.push({ label: `${parseInt(month)}月`, key: 'month' });
    }

    if (activeFilters.budget !== 'all') {
      const labels: Record<string, string> = {
        low: '¥500以下',
        medium: '¥500-1500',
        high: '¥1500以上',
      };
      tags.push({ label: labels[activeFilters.budget], key: 'budget' });
    }

    if (activeFilters.city !== 'all') {
      tags.push({ label: activeFilters.city, key: 'city' });
    }

    if (activeFilters.days !== 'all') {
      tags.push({ label: `${activeFilters.days}天`, key: 'days' });
    }

    if (activeFilters.primaryType !== 'all') {
      const config = TYPE_CONFIG[activeFilters.primaryType as keyof typeof TYPE_CONFIG];
      tags.push({ label: config?.label || activeFilters.primaryType, key: 'primaryType' });
    }

    return tags;
  }, [activeFilters]);

  return (
    <div className="flex flex-col h-full bg-[linear-gradient(180deg,#fbfcff_0%,#f6f7fb_100%)]">
      <div className="px-5 pt-14 pb-4 bg-transparent">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white border border-[var(--app-border)] flex items-center justify-center text-[var(--app-ink)] active:scale-95 transition-transform shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[18px] font-bold text-[var(--app-ink)]">预算记录</h1>
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="flex rounded-2xl bg-[var(--app-card-soft)] p-1">
          <button
            onClick={() => setViewMode('total')}
            className={`flex-1 py-2 rounded-[12px] text-[13px] font-bold transition-all ${
              viewMode === 'total'
                ? 'bg-white text-[var(--app-ink)] shadow-sm'
                : 'text-[var(--app-text)]'
            }`}
          >
            总览
          </button>
          <button
            onClick={() => setViewMode('byTrip')}
            className={`flex-1 py-2 rounded-[12px] text-[13px] font-bold transition-all ${
              viewMode === 'byTrip'
                ? 'bg-white text-[var(--app-ink)] shadow-sm'
                : 'text-[var(--app-text)]'
            }`}
          >
            分行程
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <AnimatePresence mode="wait">
          {viewMode === 'total' ? (
            <motion.div
              key="total"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {totalBudgetStats.planCount > 0 ? (
                <>
                  <TotalBudgetCard
                    totalSpent={totalBudgetStats.totalSpent}
                    planCount={totalBudgetStats.planCount}
                    avgPerTrip={totalBudgetStats.avgPerTrip}
                  />

                  <div className="app-card rounded-[24px] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[15px] font-bold text-[var(--app-ink)]">消费分类</h3>
                      <span className="text-[11px] font-bold text-[var(--app-text)]">
                        {sortedCategories.length} 个类别
                      </span>
                    </div>

                    <div className="space-y-3">
                      {sortedCategories.map((category) => (
                        <CategoryCard
                          key={category.type}
                          type={category.type}
                          amount={category.amount}
                          percentage={category.percentage}
                          count={category.count}
                          isExpanded={selectedCategory === category.type}
                          onToggle={() =>
                            setSelectedCategory(
                              selectedCategory === category.type ? null : category.type
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="app-card rounded-[24px] p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-[24px] bg-gradient-to-br from-[#FFF7FB] to-[#FFE7F1] flex items-center justify-center border border-[var(--brand)]/20">
                        <TrendingUp className="w-5 h-5 text-[var(--brand)]" />
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-[var(--app-ink)]">消费洞察</div>
                        <div className="text-[11px] font-bold text-[var(--app-text)]">
                          基于您的旅行数据
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-4 bg-[linear-gradient(135deg,#FFF7FB_0%,#FFE7F1_100%)] rounded-[24px] border border-[#FFD5E7]">
                        <div className="w-10 h-10 rounded-[24px] bg-white flex items-center justify-center shrink-0 border border-white/70 shadow-sm">
                          <Utensils className="w-5 h-5 text-[#C94B86]" />
                        </div>
                        <div className="pt-0.5">
                          <div className="text-[13px] font-bold text-[#25130E] mb-0.5">
                            {sortedCategories[0]?.type
                              ? TYPE_CONFIG[sortedCategories[0].type as keyof typeof TYPE_CONFIG]
                                  ?.label
                              : '餐饮'}
                            占主导
                          </div>
                          <div className="text-[11px] font-bold text-[#7D4B3E]/80">
                            占总预算的 {sortedCategories[0]?.percentage.toFixed(0) || 0}
                            %，是您最主要的消费类别
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-4 bg-[linear-gradient(135deg,#f0f9ff_0%,#e0f2fe_100%)] rounded-[24px] border border-[#bae6fd]">
                        <div className="w-10 h-10 rounded-[24px] bg-white flex items-center justify-center shrink-0 border border-white/70 shadow-sm">
                          <TrendingDown className="w-5 h-5 text-[#0ea5e9]" />
                        </div>
                        <div className="pt-0.5">
                          <div className="text-[13px] font-bold text-[#0c4a6e] mb-0.5">
                            平均每行程 ¥{totalBudgetStats.avgPerTrip.toLocaleString('zh-CN')}
                          </div>
                          <div className="text-[11px] font-bold text-[#0c4a6e]/70">
                            建议下次行程预算设置在平均值的 ±20% 范围内
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20"
                >
                  <div className="w-20 h-20 rounded-[24px] bg-white border border-[var(--app-border)] flex items-center justify-center mb-4 shadow-sm">
                    <Wallet className="w-10 h-10 text-[var(--app-text-soft)]" />
                  </div>
                  <div className="text-[15px] font-bold text-[var(--app-text)] mb-1">
                    暂无预算记录
                  </div>
                  <div className="text-[13px] font-bold text-[var(--app-text-soft)]">
                    完成路线规划后会显示在这里
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="byTrip"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* 筛选按钮 */}
              <div className="flex items-center justify-between mb-2">
                <div className="text-[13px] font-bold text-[var(--app-text)]">
                  共 {filteredPlans.length} 个行程
                </div>
                <button
                  onClick={openFilterPanel}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold transition-all ${
                    hasActiveFilters
                      ? 'bg-[var(--brand)] text-white'
                      : 'bg-white border border-[var(--app-border)] text-[var(--app-ink)]'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  筛选
                  {hasActiveFilters && (
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                      {activeFilterTags.length}
                    </span>
                  )}
                </button>
              </div>

              {/* 激活的筛选标签 */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {activeFilterTags.map((tag) => (
                    <span
                      key={tag.key}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--brand)]/10 text-[11px] font-bold text-[var(--brand)]"
                    >
                      {tag.label}
                    </span>
                  ))}
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--app-card-soft)] text-[11px] font-bold text-[var(--app-text)]"
                  >
                    清除筛选
                  </button>
                </div>
              )}

              {filteredPlans.length > 0 ? (
                filteredPlans.map((plan) => (
                  <TripCard
                    key={plan.id}
                    plan={plan}
                    isSelected={selectedPlanId === plan.id}
                    onToggle={() => setSelectedPlanId(selectedPlanId === plan.id ? null : plan.id)}
                  />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <div className="w-16 h-16 rounded-[24px] bg-[var(--app-card-soft)] flex items-center justify-center mb-3">
                    <List className="w-8 h-8 text-[var(--app-text-soft)]" />
                  </div>
                  <div className="text-[13px] font-bold text-[var(--app-text)] mb-1">
                    {hasActiveFilters ? '暂无符合条件的行程' : '暂无行程记录'}
                  </div>
                  <div className="text-[13px] text-[var(--app-text-soft)]">
                    {hasActiveFilters ? '尝试调整筛选条件' : '完成路线规划后会显示在这里'}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 筛选面板 */}
      <FilterPanel
        visible={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        onApply={applyFilters}
        onReset={resetFilters}
        filters={tempFilters}
        setFilters={setTempFilters}
        availableOptions={availableOptions}
      />
    </div>
  );
}
