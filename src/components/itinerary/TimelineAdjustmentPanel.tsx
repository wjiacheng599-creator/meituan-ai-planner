import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, ArrowRight, Zap, AlertTriangle } from 'lucide-react';

export interface TimelineAdjustment {
  activityName: string;
  originalTime: string;
  adjustedTime: string;
  delayMinutes: number;
  reason: string;
}

export interface TimelineAdjustmentPanelProps {
  adjustments: TimelineAdjustment[];
  isAdjusting: boolean;
  onComplete?: () => void;
}

export default function TimelineAdjustmentPanel({
  adjustments,
  isAdjusting,
  onComplete,
}: TimelineAdjustmentPanelProps) {
  const [visibleAdjustments, setVisibleAdjustments] = useState<TimelineAdjustment[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (adjustments.length > 0) {
      setVisibleAdjustments([]);
      timersRef.current = adjustments.map((adj, index) =>
        setTimeout(() => {
          setVisibleAdjustments((prev) => [...prev, adj]);
        }, index * 800)
      );
    }
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [adjustments]);

  return (
    <AnimatePresence>
      {adjustments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="mb-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 overflow-hidden"
        >
          <div className="px-4 py-3 bg-amber-100/60 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" />
              <span className="text-[13px] font-bold text-amber-800">智能时间调整</span>
              {isAdjusting && (
                <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-200 px-2 py-0.5 rounded-full">
                  调整中...
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-amber-700">
              检测到时间冲突，自动优化后续活动时间
            </p>
          </div>

          <div className="p-3 space-y-2">
            {visibleAdjustments.map((adj, index) => (
              <motion.div
                key={`${adj.activityName}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 bg-white/80 rounded-xl px-3 py-2"
              >
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-gray-800 truncate">
                    {adj.activityName}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-medium text-gray-400 line-through">
                      {adj.originalTime}
                    </span>
                    <ArrowRight className="w-3 h-3 text-amber-500" />
                    <span className="text-[11px] font-bold text-amber-600">{adj.adjustedTime}</span>
                  </div>
                </div>
                <div className="shrink-0">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                    +{adj.delayMinutes}分钟
                  </span>
                </div>
              </motion.div>
            ))}

            {adjustments.length > 0 &&
              visibleAdjustments.length === adjustments.length &&
              !isAdjusting && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center gap-2 pt-2 border-t border-amber-100"
                >
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 text-[10px]">✓</span>
                  </div>
                  <span className="text-[11px] font-semibold text-green-700">
                    时间优化完成，总计顺延 {adjustments.reduce((sum, a) => sum + a.delayMinutes, 0)}{' '}
                    分钟
                  </span>
                </motion.div>
              )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function generateMockAdjustments(
  activities: Array<{ title: string; timeLine: string }>
): TimelineAdjustment[] {
  const mockAdjustments: TimelineAdjustment[] = [];
  let accumulatedDelay = 0;

  for (let i = 1; i < Math.min(activities.length, 3); i++) {
    const delay = Math.floor(Math.random() * 20) + 10;
    accumulatedDelay += delay;

    const timeMatch = activities[i].timeLine.match(/(\d{2}):(\d{2})\s*[-–]\s*(\d{2}):(\d{2})/);
    if (timeMatch) {
      const startHour = parseInt(timeMatch[1]);
      const startMin = parseInt(timeMatch[2]);
      const newStartMin = startMin + delay;
      const adjustedHour = newStartMin >= 60 ? startHour + 1 : startHour;
      const adjustedMin = newStartMin >= 60 ? newStartMin - 60 : newStartMin;

      const endHour = parseInt(timeMatch[3]);
      const endMin = parseInt(timeMatch[4]);
      const newEndMin = endMin + delay;
      const adjustedEndHour = newEndMin >= 60 ? endHour + 1 : endHour;
      const adjustedEndMin = newEndMin >= 60 ? newEndMin - 60 : newEndMin;

      mockAdjustments.push({
        activityName: activities[i].title,
        originalTime: activities[i].timeLine,
        adjustedTime: `${String(adjustedHour).padStart(2, '0')}:${String(adjustedMin).padStart(2, '0')} - ${String(adjustedEndHour).padStart(2, '0')}:${String(adjustedEndMin).padStart(2, '0')}`,
        delayMinutes: delay,
        reason: '前序活动超时',
      });
    }
  }

  return mockAdjustments;
}
