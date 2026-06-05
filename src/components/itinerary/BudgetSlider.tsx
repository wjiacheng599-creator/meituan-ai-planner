import React, { useEffect, useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export interface BudgetSliderProps {
  min: number;
  max: number;
  step: number;
  currentValue: number;
  label: string;
  onConfirm: (value: number) => void;
  onCancel?: () => void;
}

export default function BudgetSlider({
  min,
  max,
  step,
  currentValue,
  label,
  onConfirm,
  onCancel,
}: BudgetSliderProps) {
  // 安全地处理数值数据
  const safeMin = typeof min === 'number' && !isNaN(min) ? min : 100;
  const safeMax =
    typeof max === 'number' && !isNaN(max) && max > safeMin ? max : Math.max(500, safeMin * 2);
  const safeStep = typeof step === 'number' && !isNaN(step) && step > 0 ? step : 50;
  const safeCurrentValue =
    typeof currentValue === 'number' && !isNaN(currentValue)
      ? Math.min(Math.max(currentValue, safeMin), safeMax)
      : safeMin;
  const safeLabel = typeof label === 'string' ? label : '调整预算';

  const [localValue, setLocalValue] = useState(safeCurrentValue);
  const [inputValue, setInputValue] = useState(String(safeCurrentValue));
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setLocalValue(safeCurrentValue);
    setInputValue(String(safeCurrentValue));
  }, [safeCurrentValue]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setLocalValue(value);
    setInputValue(String(value));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const num = Number(val);
    if (!isNaN(num) && num >= safeMin && num <= safeMax) {
      setLocalValue(num);
    }
  };

  const handleInputBlur = () => {
    const num = Number(inputValue);
    if (!isNaN(num)) {
      const clamped = Math.min(Math.max(num, safeMin), safeMax);
      setLocalValue(clamped);
      setInputValue(String(clamped));
    } else {
      setInputValue(String(localValue));
    }
  };

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm(localValue);
  };

  const percentage = ((localValue - safeMin) / (safeMax - safeMin)) * 100;

  const formatCurrency = (value: number) => {
    if (value >= 10000) {
      return `¥${(value / 10000).toFixed(1)}万`;
    }
    return `¥${value}`;
  };

  if (confirmed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)]"
      >
        <div className="flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-[var(--mint-ink)] bg-[var(--mint-soft)] rounded-2xl">
          <Check className="w-4 h-4" />
          已确认预算 {formatCurrency(localValue)}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)]"
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
          <ArrowRight className="w-4 h-4 text-amber-500" />
        </div>
        <p className="text-[13px] font-bold text-gray-700">{safeLabel}</p>
      </div>

      {/* 预算显示和输入 */}
      <div className="flex items-center gap-3 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
        <span className="text-[20px] font-bold text-gray-800">¥</span>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          className="flex-1 bg-transparent border-none text-[20px] font-bold text-gray-800 outline-none"
          placeholder="输入预算"
        />
      </div>

      {/* 滑块 */}
      <div className="relative mb-4">
        <input
          type="range"
          min={safeMin}
          max={safeMax}
          step={safeStep}
          value={localValue}
          onChange={handleSliderChange}
          className="w-full h-2 rounded-full appearance-none cursor-pointer
            bg-gray-200
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-amber-400
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-amber-500
            [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(245,158,11,0.2)]
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:duration-150
            [&::-webkit-slider-thumb]:active:scale-110
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-amber-400
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-amber-500
            [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(245,158,11,0.2)]
            [&::-moz-range-thumb]:cursor-pointer"
          style={{
            background: `linear-gradient(to right, #fef3c7 0%, #fbbf24 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
          }}
        />
      </div>

      <div className="flex justify-between text-[11px] font-medium text-gray-400 mb-4">
        <span>{formatCurrency(safeMin)}</span>
        <span>{formatCurrency(safeMax)}</span>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={confirmed}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 transition-all"
          >
            取消
          </button>
        )}
        <button
          onClick={handleConfirm}
          disabled={confirmed}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-amber-400 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-default transition-all flex items-center justify-center gap-1.5"
        >
          {confirmed ? (
            <>
              <Check className="w-4 h-4" /> 已确认
            </>
          ) : (
            '确认调整'
          )}
        </button>
      </div>
    </motion.div>
  );
}
