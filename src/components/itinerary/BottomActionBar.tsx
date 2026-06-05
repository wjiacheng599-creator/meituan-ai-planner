import React from 'react';
import type { TravelMode } from '../../types';
import { Zap, CheckCircle2, Check, CarTaxiFront, XCircle } from 'lucide-react';
import XiaoMeiAvatar from '../mascot/XiaoMeiAvatar';

export interface BottomActionBarProps {
  selectedCount: number;
  hasBooked: boolean;
  isExecuting: boolean;
  isCompleted?: boolean;
  executeButtonLabel: string;
  travelMode: TravelMode;
  onOpenCopilot: () => void;
  onExecute: () => void;
  onCancel?: () => void;
  onProceedPayment?: () => void;
}

export default function BottomActionBar({
  selectedCount,
  hasBooked,
  isExecuting,
  isCompleted = false,
  executeButtonLabel,
  travelMode,
  onOpenCopilot,
  onExecute,
  onCancel,
  onProceedPayment,
}: BottomActionBarProps) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 px-4 pt-4 pb-6 bg-white/95 backdrop-blur-xl border-t border-gray-100/50 z-30"
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex gap-2">
        {isExecuting ? (
          <button
            onClick={onCancel}
            className="px-4 py-3.5 bg-red-50 rounded-2xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
          >
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-[13px] font-bold text-red-700">取消</span>
          </button>
        ) : (
          <button
            onClick={onOpenCopilot}
            className="px-4 py-3.5 bg-gray-100 rounded-2xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
          >
            <XiaoMeiAvatar mood="smile" size="w-7 h-7" />
            <span className="text-[13px] font-bold text-gray-700">管家</span>
          </button>
        )}
        {isExecuting ? (
          <div className="flex-1 flex flex-col justify-center py-2">
            <div className="text-center text-[13px] font-bold text-gray-700">正在执行...</div>
            <div className="w-full h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-[var(--mint-ink)] animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        ) : isCompleted ? (
          <button
            disabled
            className="flex-1 bg-[var(--mint-ink)] text-white font-bold py-3.5 rounded-2xl text-[13px] shadow-[0_6px_20px_rgba(42,162,122,0.24)] flex items-center justify-center gap-2 cursor-default"
          >
            <CheckCircle2 className="w-4 h-4" />
            行程已完成
          </button>
        ) : selectedCount > 0 ? (
          <button
            onClick={onExecute}
            className="app-btn-primary flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-bold active:scale-[0.98] transition-transform cursor-pointer"
          >
            {travelMode === 'taxi' ? (
              <CarTaxiFront className="w-4 h-4" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {executeButtonLabel}
          </button>
        ) : hasBooked ? (
          <button
            onClick={onProceedPayment}
            className="flex-1 bg-[var(--mint-ink)] text-white font-bold py-3.5 rounded-2xl text-[13px] shadow-[0_6px_20px_rgba(42,162,122,0.24)] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            去付款
          </button>
        ) : (
          <button
            disabled
            className="flex-1 bg-gray-900 text-white font-bold py-3.5 rounded-2xl text-[13px] shadow-[0_6px_20px_rgba(0,0,0,0.15)] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            {executeButtonLabel}
          </button>
        )}
      </div>
    </div>
  );
}
