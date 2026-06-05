import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastContext, type ToastMessage } from '../../hooks/useToast';

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_COLORS: Record<string, string> = {
  success: 'bg-[#e8f5e9] border-[#4caf50] text-[#2e7d32]',
  error: 'bg-[#fce4ec] border-[#e53935] text-[#c62828]',
  warning: 'bg-[#fff3e0] border-[#f57c00] text-[#e65100]',
  info: 'bg-[#e3f2fd] border-[#1e88e5] text-[#1565c0]',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (msg: Omit<ToastMessage, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { ...msg, id }]);

      if (msg.duration !== 0) {
        setTimeout(() => {
          dismissToast(id);
        }, msg.duration ?? 3000);
      }
    },
    [dismissToast]
  );

  const contextValue = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        className="fixed bottom-24 left-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = TOAST_ICONS[toast.type];
            const colors = TOAST_COLORS[toast.type];
            return (
              <motion.div
                key={toast.id}
                initial={{ y: 64, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 24, opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 24, stiffness: 320 }}
                className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3.5 border shadow-lg backdrop-blur-md max-w-[420px] mx-auto w-full ${colors}`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[13px] font-bold flex-1">{toast.message}</span>
                {toast.action && (
                  <button
                    onClick={toast.action.onClick}
                    className="text-[13px] font-bold underline shrink-0"
                  >
                    {toast.action.label}
                  </button>
                )}
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="关闭提示"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
