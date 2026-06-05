import { CircleAlert, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InviteErrorBannerProps {
  error: string | null;
  onDismiss: () => void;
}

export default function InviteErrorBanner({ error, onDismiss }: InviteErrorBannerProps) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="absolute top-4 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#fef2f2] border border-red-200 shadow-lg"
        >
          <CircleAlert className="w-5 h-5 shrink-0 text-[var(--danger-ink)]" strokeWidth={2} />
          <span className="flex-1 text-sm font-medium text-red-700">{error}</span>
          <button
            onClick={onDismiss}
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-100 active:scale-95 transition-all"
          >
            <X className="w-4 h-4 text-[var(--danger-ink)]" strokeWidth={2} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
