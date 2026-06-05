import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface ScreenGuardProps {
  children: ReactNode;
  data: unknown;
  fallback?: ReactNode;
  onBack?: () => void;
}

/**
 * ScreenGuard - Protects screens from rendering with missing required data
 * Instead of returning null (white screen), shows a friendly error state
 */
export default function ScreenGuard({ children, data, fallback, onBack }: ScreenGuardProps) {
  if (!data) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-full flex-col items-center justify-center px-8"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-[18px] font-bold text-gray-900 mb-2">数据加载失败</h3>
          <p className="text-[13px] text-gray-500 mb-6 leading-relaxed">
            页面所需数据未找到，请返回重试
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="app-btn rounded-full px-6 py-2.5 text-[13px] font-medium"
            >
              返回上一页
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return <>{children}</>;
}
