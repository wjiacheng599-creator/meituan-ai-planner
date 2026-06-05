/**
 * EmptyState — 统一空状态组件
 *
 * 小美表情 + 引导文案 + CTA 按钮
 */
import React from 'react';
import { motion } from 'motion/react';
import XiaoMeiAvatar from '../mascot/XiaoMeiAvatar';
import type { XiaoMeiMood } from '../mascot/XiaoMeiAvatar';

interface EmptyStateProps {
  mood?: XiaoMeiMood;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  mood = 'greeting',
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center py-5 px-6 text-center ${className}`}
    >
      <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-gray-100">
        <XiaoMeiAvatar mood={mood} size="w-14 h-14" />
      </div>
      <p className="text-[15px] font-bold text-gray-800 mb-1.5">{title}</p>
      {description && (
        <p className="text-[13px] font-medium text-gray-400 max-w-[220px] leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-6 py-2.5 rounded-full bg-gray-900 text-white text-[13px] font-bold active:scale-[0.97] transition-transform shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
