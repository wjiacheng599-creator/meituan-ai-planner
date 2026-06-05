import React, { useState } from 'react';
import { Check, Clock, Minus, Plus } from 'lucide-react';

export interface TimeAdjusterProps {
  activityId: string;
  currentTime: string;
  minTime: string;
  maxTime: string;
  label: string;
  onConfirm: (activityId: string, newTime: string) => void;
  onCancel?: () => void;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 24 * 60 - 1));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function TimeAdjuster({
  activityId,
  currentTime,
  minTime,
  maxTime,
  label,
  onConfirm,
  onCancel,
}: TimeAdjusterProps) {
  // 安全地处理时间数据
  const safeCurrentTime =
    typeof currentTime === 'string' && /^\d{1,2}:\d{2}$/.test(currentTime) ? currentTime : '12:00';
  const safeMinTime =
    typeof minTime === 'string' && /^\d{1,2}:\d{2}$/.test(minTime) ? minTime : '06:00';
  const safeMaxTime =
    typeof maxTime === 'string' && /^\d{1,2}:\d{2}$/.test(maxTime) ? maxTime : '22:00';
  const safeLabel = typeof label === 'string' ? label : '';
  const safeActivityId = typeof activityId === 'string' ? activityId : '';

  const [localTime, setLocalTime] = useState(safeCurrentTime);
  const [confirmed, setConfirmed] = useState(false);

  const currentMinutes = timeToMinutes(localTime);
  const minMinutes = timeToMinutes(safeMinTime);
  const maxMinutes = timeToMinutes(safeMaxTime);

  const canDecrease = currentMinutes - 15 >= minMinutes;
  const canIncrease = currentMinutes + 15 <= maxMinutes;

  const handleAdjust = (delta: number) => {
    const newMinutes = currentMinutes + delta;
    if (newMinutes < minMinutes || newMinutes > maxMinutes) return;
    setLocalTime(minutesToTime(newMinutes));
  };

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm(safeActivityId, localTime);
  };

  if (confirmed) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-gray-100/60">
        <div className="flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-[var(--mint-ink)] bg-[var(--mint-soft)] rounded-2xl">
          <Check className="w-4 h-4" />
          已确认时间 {localTime}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-gray-100/60">
      <div className="flex items-center gap-1.5 mb-4">
        <Clock className="w-3.5 h-3.5 text-[var(--sky-ink)]" />
        <span className="text-[13px] font-semibold text-gray-500 truncate">{safeLabel}</span>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={() => handleAdjust(-15)}
          disabled={!canDecrease}
          className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-[13px] font-bold transition-all duration-150 active:scale-95
            bg-gray-100 text-gray-600 hover:bg-gray-200
            disabled:opacity-30 disabled:active:scale-100 cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
          15分钟
        </button>

        <div className="text-[32px] font-bold text-[var(--brand-ink)] leading-none tracking-tight tabular-nums">
          {localTime}
        </div>

        <button
          onClick={() => handleAdjust(15)}
          disabled={!canIncrease}
          className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-[13px] font-bold transition-all duration-150 active:scale-95
            bg-gray-100 text-gray-600 hover:bg-gray-200
            disabled:opacity-30 disabled:active:scale-100 cursor-pointer"
        >
          +15分钟
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-1 rounded-2xl py-3 text-[13px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-transform cursor-pointer"
          >
            取消
          </button>
        )}
        <button
          onClick={handleConfirm}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand-ink)] active:scale-[0.98] transition-transform cursor-pointer"
        >
          <Check className="w-4 h-4" />
          确认时间
        </button>
      </div>
    </div>
  );
}
