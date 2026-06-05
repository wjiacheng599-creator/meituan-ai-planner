import { motion } from 'motion/react';
import { useState } from 'react';
import React from 'react';
import {
  ArrowLeft,
  Edit3,
  Minus,
  Plus,
  Star,
  ThumbsUp,
  Baby,
  Heart,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Utensils,
  Car,
  Tent,
  MapPin,
  Pin,
  Receipt,
  DollarSign,
  Clock,
} from 'lucide-react';
import type { Activity } from '../../services/ai';

const vibeOptions = [
  {
    icon: <ThumbsUp className="w-5 h-5 text-[var(--peach-ink)]" />,
    label: '全票通过',
    selected: true,
  },
  {
    icon: <Baby className="w-5 h-5 text-[var(--app-text-soft)]" />,
    label: '小朋友最爱',
    selected: false,
  },
  {
    icon: <Heart className="w-5 h-5 text-[var(--app-text-soft)]" />,
    label: '长辈友好',
    selected: false,
  },
  {
    icon: <Lightbulb className="w-5 h-5 text-[var(--app-text-soft)]" />,
    label: 'AI 推荐',
    selected: false,
  },
  {
    icon: <DollarSign className="w-5 h-5 text-[var(--app-text-soft)]" />,
    label: '预算较高',
    selected: false,
  },
];

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    美食: 'bg-[var(--peach-soft)] text-[var(--peach-ink)]',
    出行: 'bg-[var(--sky-soft)] text-[var(--sky-ink)]',
    活动: 'bg-[var(--rose-soft)] text-[var(--rose-ink)]',
  };
  return colors[category] || 'bg-[var(--app-card-soft)] text-[var(--app-text)]';
};

const getCategoryIcon = (category: string): React.ReactNode => {
  const icons: Record<string, React.ReactNode> = {
    美食: <Utensils className="w-3.5 h-3.5" />,
    出行: <Car className="w-3.5 h-3.5" />,
    活动: <Tent className="w-3.5 h-3.5" />,
  };
  return icons[category] || <Pin className="w-3.5 h-3.5" />;
};

const groupActivitiesByCategory = (activities: Activity[]) => {
  return activities.reduce(
    (acc, act) => {
      const key = act.type === 'food' ? '美食' : act.type === 'travel' ? '出行' : '活动';
      if (!acc[key]) acc[key] = [];
      acc[key].push(act);
      return acc;
    },
    {} as Record<string, Activity[]>
  );
};

interface ChecklistProps {
  plan: { activities: Activity[]; summary: string; totalPrice: number };
  onBack: () => void;
  onConfirm?: () => void;
  selectedIds?: Set<string>;
  bookedIds?: Set<string>;
  onToggleActivity?: (id: string) => void;
  profiles?: Array<{ name: string }>;
}

export default function Checklist({
  plan,
  onBack,
  onConfirm,
  selectedIds,
  bookedIds,
  onToggleActivity,
}: ChecklistProps) {
  const [budget, setBudget] = useState(1000);
  const grouped = groupActivitiesByCategory(plan.activities);
  const isOverBudget = plan.totalPrice > budget;
  const selectedCount = selectedIds?.size ?? 0;

  return (
    <div className="app-shell relative flex h-full w-full flex-col overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute bottom-0 left-0 right-0 h-[500px] pointer-events-none z-0 opacity-60">
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-[rgba(231,237,247,0.85)] blur-[100px]"></div>
        <div className="absolute bottom-0 right-0 h-[250px] w-[250px] rounded-full bg-[rgba(255,231,241,0.72)] blur-[100px]"></div>
      </div>

      {/* Header */}
      <div className="px-5 pt-14 pb-2 flex items-center relative z-20 bg-white/80 backdrop-blur-md border-b border-[var(--app-border)]/80">
        <button
          onClick={onBack}
          className="p-2 -ml-2 hover:bg-[var(--app-card-soft)] rounded-full transition-colors cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--app-ink)]" strokeWidth={2.5} />
        </button>
        <h1 className="text-[18px] font-bold text-[var(--app-ink)] absolute left-1/2 -translate-x-1/2">
          确认行程
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 pt-4 relative z-10 space-y-6">
        {/* Title & Summary */}
        <div>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-[22px] font-bold text-[var(--app-ink)] leading-tight mb-2">
                周末探索计划
              </h2>
              <p className="text-[13px] font-bold text-[var(--app-text)] leading-relaxed">
                {plan.summary}
              </p>
            </div>
            <div className="ml-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--rose-soft)_0%,var(--peach-soft)_100%)] shadow-[0_4px_16px_rgba(201,75,134,0.14)]">
              <Star className="w-7 h-7 text-white" fill="white" />
            </div>
          </div>

          {/* Vibe Selection */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-5 px-5">
            {vibeOptions.map((opt) => (
              <button
                key={opt.label}
                className={`flex flex-col items-center justify-center shrink-0 w-[72px] h-[72px] rounded-[24px] border transition-all cursor-pointer active:scale-95 ${
                  opt.selected
                    ? 'bg-[var(--peach-soft)] border-[var(--peach-strong)] shadow-[0_4px_12px_rgba(217,139,76,0.12)]'
                    : 'bg-white border-[var(--app-border)] hover:bg-[var(--app-card-soft)]'
                }`}
              >
                <div className="mb-1">{opt.icon}</div>
                <span
                  className={`text-[10px] font-bold whitespace-nowrap ${opt.selected ? 'text-[var(--peach-ink)]' : 'text-[var(--app-text)]'}`}
                >
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Budget Control */}
        <div className="app-card rounded-[24px] p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[15px] font-bold text-[var(--app-ink)] flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[var(--peach-ink)]" /> 总预算
            </span>
            <div
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${isOverBudget ? 'bg-[var(--rose-soft)] text-[var(--rose-ink)]' : 'bg-[var(--mint-soft)] text-[var(--mint-ink)]'}`}
            >
              {isOverBudget ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              {isOverBudget ? '超出预算' : '预算内'}
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mb-4">
            <button
              onClick={() => setBudget((prev) => Math.max(0, prev - 100))}
              className="w-12 h-12 rounded-full bg-[var(--app-card-soft)] text-[var(--app-text)] flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer active:scale-95"
            >
              <Minus className="w-5 h-5" />
            </button>
            <div className="text-center">
              <span className="text-[42px] font-bold text-[var(--app-ink)] tracking-tight">
                ¥{budget}
              </span>
            </div>
            <button
              onClick={() => setBudget((prev) => prev + 100)}
              className="w-12 h-12 rounded-full bg-[var(--app-card-soft)] text-[var(--app-text)] flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full h-2 bg-[var(--app-card-soft)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${budget > 0 ? Math.min(100, (plan.totalPrice / budget) * 100) : 0}%`,
              }}
              transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
              className={`absolute top-0 left-0 h-full rounded-full ${isOverBudget ? 'bg-[var(--rose-ink)]' : 'bg-[var(--mint-ink)]'}`}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-bold text-[var(--app-text-soft)]">
            <span>已规划 ¥{plan.totalPrice}</span>
            <span>剩余 ¥{Math.max(0, budget - plan.totalPrice)}</span>
          </div>
        </div>

        {/* Category Groups */}
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[13px] font-bold ${getCategoryColor(category).split(' ')[1]}`}>
                {getCategoryIcon(category)} {category}
              </span>
              <span className="text-[10px] font-bold text-[var(--app-text-soft)]">
                ¥{items.reduce((sum, i) => sum + i.price, 0)}
              </span>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const isBooked = bookedIds?.has(item.id) ?? false;
                const isSelected = selectedIds?.has(item.id) ?? false;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`bg-white rounded-[24px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border ${
                      isBooked
                        ? 'border-[var(--mint-strong)] bg-[rgba(238,248,241,0.6)]'
                        : isSelected
                          ? 'border-[var(--peach-strong)] bg-[rgba(255,241,225,0.58)]'
                          : 'border-[var(--app-border)]/80'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <span className="text-[15px] font-bold text-[var(--app-ink)] block mb-1">
                          {item.title}
                        </span>
                        <div className="flex items-center gap-1.5 text-[var(--app-text-soft)]">
                          <Clock className="w-3 h-3" />
                          <span className="text-[11px] font-bold">{item.timeLine}</span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${getCategoryColor(category)}`}
                      >
                        {category}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-[var(--app-text-soft)]" />
                        <span className="text-[11px] font-bold text-[var(--app-text)] truncate max-w-[180px]">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[13px] font-bold text-[var(--app-ink)]">
                        ¥{item.price}
                      </span>
                    </div>
                    {onToggleActivity && (
                      <button
                        onClick={() => onToggleActivity(item.id)}
                        className={`mt-3 w-full py-2 rounded-xl text-[13px] font-bold transition-colors cursor-pointer active:scale-95 ${
                          isBooked
                            ? 'bg-[var(--mint-ink)] text-white'
                            : isSelected
                              ? 'bg-[var(--peach-ink)] text-white'
                              : 'bg-[var(--app-card-soft)] text-[var(--app-text)] hover:bg-gray-200'
                        }`}
                      >
                        {isBooked ? '已预订 ✓' : isSelected ? '已加入待支付' : '加入待支付'}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Action Bar */}
      <div className="px-5 pb-8 pt-4 bg-gradient-to-t from-[#F7F8FA] to-transparent z-20 flex flex-col gap-3">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Receipt className="w-4 h-4 text-[var(--app-text-soft)]" />
          <span className="text-[11px] font-bold text-[var(--app-text-soft)]">
            已选 {selectedCount} 项待支付
          </span>
        </div>
        <button
          onClick={onConfirm}
          disabled={selectedCount === 0}
          className="app-btn-primary flex w-full items-center justify-center gap-2 rounded-[24px] py-4 text-[15px] font-bold active:scale-[0.97] transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Edit3 className="w-4 h-4" /> 确认并生成最终行程
        </button>
      </div>
    </div>
  );
}
