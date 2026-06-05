/**
 * RequirementConfirmCard - 需求澄清结构化引导卡片
 *
 * 在用户输入模糊需求后，以消息气泡形式展示结构化选项，
 * 让用户快速确认日期、人数、偏好、预算等关键维度。
 *
 * 设计风格：沿用 app 现有的圆角卡片 + 柔和渐变 + 标签选择器
 */
import React, { useState, memo, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Users,
  Heart,
  Wallet,
  Sparkles,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
  Camera,
  Leaf,
  Landmark,
  ShoppingBag,
  Ticket,
  Baby,
  Accessibility,
  Salad,
  Car,
} from 'lucide-react';

export interface RequirementData {
  date: string;
  days: number;
  people: number;
  hasChildren: boolean;
  hasElderly: boolean;
  budget: [number, number];
  preferences: string[];
  specialNeeds: string[];
}

interface RequirementConfirmCardProps {
  initialData?: Partial<RequirementData>;
  missingFields?: string[]; // 缺失字段列表，用于只展示缺失项
  onConfirm: (data: RequirementData) => void;
  onSkip: () => void;
}

const DATE_OPTIONS = ['今天', '明天', '周六', '周日'];
const DAYS_OPTIONS = [
  { label: '半日', value: 0.5 },
  { label: '1天', value: 1 },
  { label: '2天', value: 2 },
  { label: '3天+', value: 3 },
];
const PEOPLE_OPTIONS = [
  { label: '1人', value: 1 },
  { label: '2人', value: 2 },
  { label: '3-4人', value: 4 },
  { label: '5人+', value: 5 },
];
const PREFERENCE_OPTIONS = [
  { label: '美食', icon: UtensilsCrossed },
  { label: '拍照', icon: Camera },
  { label: '自然', icon: Leaf },
  { label: '文化', icon: Landmark },
  { label: '购物', icon: ShoppingBag },
  { label: '娱乐', icon: Ticket },
];
const SPECIAL_OPTIONS = [
  { label: '带娃', icon: Baby },
  { label: '老人友好', icon: Accessibility },
  { label: '无障碍', icon: Accessibility },
  { label: '素食', icon: Salad },
  { label: '自驾', icon: Car },
];
const BUDGET_OPTIONS = [
  { label: '¥0-500', value: [0, 500] as [number, number] },
  { label: '¥500-1000', value: [500, 1000] as [number, number] },
  { label: '¥1000+', value: [1000, 5000] as [number, number] },
];

function TagSelector<T extends string>({
  options,
  selected,
  onToggle,
  renderLabel,
}: {
  options: T[];
  selected: T[];
  onToggle: (val: T) => void;
  renderLabel?: (val: T) => React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={`
              px-3 py-1.5 rounded-full text-[13px] font-bold border transition-all duration-150
              ${
                active
                  ? 'bg-[var(--brand)] text-[var(--brand-ink)] shadow-[0_4px_12px_rgba(255,200,58,0.25)] border-transparent'
                  : 'bg-[var(--app-card-soft)] text-[var(--app-text)] border-[var(--app-border)] hover:bg-[var(--app-card-soft)]'
              }
            `}
          >
            {renderLabel ? renderLabel(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

function OptionGroup<T>({
  options,
  selected,
  onSelect,
  getLabel,
  getValue,
}: {
  options: T[];
  selected: T | null;
  onSelect: (val: T) => void;
  getLabel: (val: T) => string;
  getValue: (val: T) => string | number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected !== null && getValue(selected) === getValue(opt);
        return (
          <button
            key={String(getValue(opt))}
            onClick={() => onSelect(opt)}
            className={`
              px-3.5 py-1.5 rounded-full text-[13px] font-bold transition-all duration-150
              ${
                active
                  ? 'bg-[var(--brand)] text-[var(--brand-ink)] shadow-[0_4px_12px_rgba(255,200,58,0.25)]'
                  : 'bg-[var(--app-card-soft)] text-[var(--app-text)] border border-[var(--app-border)] hover:bg-[var(--app-card-soft)]'
              }
            `}
          >
            {getLabel(opt)}
          </button>
        );
      })}
    </div>
  );
}

const RequirementConfirmCard = memo(function RequirementConfirmCard({
  initialData,
  missingFields,
  onConfirm,
  onSkip,
}: RequirementConfirmCardProps) {
  const [date, setDate] = useState(initialData?.date || '今天');
  const [days, setDays] = useState(initialData?.days || 1);
  const [people, setPeople] = useState(initialData?.people || 2);
  const [preferences, setPreferences] = useState<string[]>(initialData?.preferences || []);
  const [specialNeeds, setSpecialNeeds] = useState<string[]>(initialData?.specialNeeds || []);
  const [budget, setBudget] = useState<[number, number]>(initialData?.budget || [0, 1000]);
  const [expanded, setExpanded] = useState(false);

  // 判断某个字段是否需要追问（缺失或未填）
  const isMissing = useCallback(
    (field: string) => {
      if (!missingFields || missingFields.length === 0) return true; // 无缺失信息时全部展示
      return missingFields.includes(field);
    },
    [missingFields]
  );

  // 已填字段是否折叠展示
  const hasAnyMissing = missingFields && missingFields.length > 0;

  const togglePreference = useCallback((val: string) => {
    setPreferences((prev) => (prev.includes(val) ? prev.filter((p) => p !== val) : [...prev, val]));
  }, []);

  const toggleSpecial = useCallback((val: string) => {
    setSpecialNeeds((prev) =>
      prev.includes(val) ? prev.filter((p) => p !== val) : [...prev, val]
    );
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm({
      date,
      days,
      people,
      hasChildren: specialNeeds.includes('带娃'),
      hasElderly: specialNeeds.includes('老人友好'),
      budget,
      preferences,
      specialNeeds,
    });
  }, [date, days, people, specialNeeds, budget, preferences, onConfirm]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full max-w-[320px] rounded-[24px] border border-[rgba(255,255,255,0.7)] bg-[rgba(255,255,255,0.97)] shadow-[0_12px_36px_rgba(20,24,33,0.1)] backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-[var(--brand-soft)] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[var(--brand-ink)]" />
          </div>
          <span className="text-[13px] font-bold text-[var(--app-ink)]">确认一下出行信息</span>
        </div>
        <p className="text-[11px] text-[var(--app-text-soft)] pl-9">帮你规划更精准的路线</p>
      </div>

      {/* Core Fields - Always visible */}
      <div className="px-5 pb-4 space-y-5">
        {/* Date */}
        <div className="pb-5 border-b border-[var(--app-border)]">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[var(--app-text-soft)]" />
            <span className="text-[13px] font-semibold text-[var(--app-ink)]">出行日期</span>
          </div>
          <TagSelector options={DATE_OPTIONS} selected={[date]} onToggle={(val) => setDate(val)} />
        </div>

        {/* Days */}
        <div className="pb-5 border-b border-[var(--app-border)]">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[var(--app-text-soft)]" />
            <span className="text-[13px] font-semibold text-[var(--app-ink)]">天数</span>
          </div>
          <OptionGroup
            options={DAYS_OPTIONS}
            selected={DAYS_OPTIONS.find((o) => o.value === days) || null}
            onSelect={(opt) => setDays(opt.value)}
            getLabel={(opt) => opt.label}
            getValue={(opt) => opt.value}
          />
        </div>

        {/* People */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[var(--app-text-soft)]" />
            <span className="text-[13px] font-semibold text-[var(--app-ink)]">人数</span>
          </div>
          <OptionGroup
            options={PEOPLE_OPTIONS}
            selected={PEOPLE_OPTIONS.find((o) => o.value === people) || null}
            onSelect={(opt) => setPeople(opt.value)}
            getLabel={(opt) => opt.label}
            getValue={(opt) => opt.value}
          />
        </div>
      </div>

      {/* Expandable Fields */}
      <div className="px-5 pb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-[11px] text-[var(--app-text-soft)] font-medium hover:text-[var(--app-text)] transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? '收起更多' : '更多偏好（可选）'}
        </button>
      </div>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="px-5 pb-4 space-y-5"
        >
          {/* Preferences */}
          <div className="pb-5 border-b border-[var(--app-border)]">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-[var(--app-text-soft)]" />
              <span className="text-[13px] font-semibold text-[var(--app-ink)]">偏好标签</span>
            </div>
            <TagSelector
              options={PREFERENCE_OPTIONS.map((p) => p.label)}
              selected={preferences}
              onToggle={togglePreference}
              renderLabel={(val) => {
                const pref = PREFERENCE_OPTIONS.find((p) => p.label === val);
                const Icon = pref?.icon;
                return (
                  <span className="flex items-center gap-1.5">
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {val}
                  </span>
                );
              }}
            />
          </div>

          {/* Special Needs */}
          <div className="pb-5 border-b border-[var(--app-border)]">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[var(--app-text-soft)]" />
              <span className="text-[13px] font-semibold text-[var(--app-ink)]">特殊需求</span>
            </div>
            <TagSelector
              options={SPECIAL_OPTIONS.map((s) => s.label)}
              selected={specialNeeds}
              onToggle={toggleSpecial}
              renderLabel={(val) => {
                const spec = SPECIAL_OPTIONS.find((s) => s.label === val);
                const Icon = spec?.icon;
                return (
                  <span className="flex items-center gap-1.5">
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {val}
                  </span>
                );
              }}
            />
          </div>

          {/* Budget */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-[var(--app-text-soft)]" />
              <span className="text-[13px] font-semibold text-[var(--app-ink)]">预算区间</span>
            </div>
            <OptionGroup
              options={BUDGET_OPTIONS}
              selected={
                BUDGET_OPTIONS.find((b) => b.value[0] === budget[0] && b.value[1] === budget[1]) ||
                null
              }
              onSelect={(opt) => setBudget(opt.value)}
              getLabel={(opt) => opt.label}
              getValue={(opt) => opt.value.join('-')}
            />
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <div className="px-5 pb-5 pt-2 flex gap-2">
        <button
          onClick={onSkip}
          className="flex-1 py-2.5 rounded-2xl text-[13px] font-bold text-[var(--app-text-soft)] bg-[var(--app-card-soft)] hover:bg-[var(--app-card-soft)] transition-colors"
        >
          跳过，直接规划
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 py-2.5 rounded-2xl text-[13px] font-bold text-[var(--brand-ink)] bg-[var(--brand)] shadow-[0_6px_20px_rgba(255,200,58,0.3)] hover:shadow-[0_8px_24px_rgba(255,200,58,0.4)] active:scale-[0.97] transition-all"
        >
          开始规划
        </button>
      </div>
    </motion.div>
  );
});

export default RequirementConfirmCard;
