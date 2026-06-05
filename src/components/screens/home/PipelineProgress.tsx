import React from 'react';
import { CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import XiaoMeiAvatar from '../../mascot/XiaoMeiAvatar';

export interface PipelineStep {
  id: string;
  title: string;
  icon: React.ReactNode;
  status: 'pending' | 'running' | 'done';
  summary?: string;
}

interface PipelineProgressProps {
  title?: string;
  summary?: string;
  collapsed?: boolean;
  steps: PipelineStep[];
}

export default function PipelineProgress({
  title,
  summary,
  collapsed,
  steps,
}: PipelineProgressProps) {
  return (
    <div className="flex items-start gap-2.5 max-w-[95%] mt-2">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--rose-strong)] bg-[rgba(255,231,241,0.78)] shadow-inner">
        <XiaoMeiAvatar mood="thinking" size="w-7 h-7" />
      </div>
      <div className="w-full rounded-[24px] border border-[var(--rose-strong)] bg-white/96 p-4 shadow-[0_10px_30px_rgba(201,75,134,0.06)]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,231,241,0.88)] text-[var(--rose-ink)]">
            {collapsed ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[var(--app-ink)]">
              {title || '正在为你规划行程...'}
            </div>
            {summary && (
              <div className="mt-0.5 text-[11px] font-bold leading-relaxed text-[var(--app-text)]">
                {summary}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-2xl bg-[linear-gradient(135deg,rgba(255,247,251,0.95)_0%,rgba(255,241,225,0.68)_100%)] px-3 py-3">
                <div className="space-y-2.5">
                  {steps.map((step, index) => (
                    <div key={step.id} className="flex gap-2.5">
                      <div className="flex w-7 flex-col items-center shrink-0">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                            step.status === 'done'
                              ? 'border-[var(--mint-strong)] bg-[var(--mint-soft)] text-[var(--mint-ink)]'
                              : step.status === 'running'
                                ? 'border-[var(--peach-strong)] bg-white text-[var(--peach-ink)]'
                                : 'border-[var(--app-border)] bg-white text-[var(--app-text-soft)]'
                          }`}
                        >
                          {step.status === 'done' ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : step.status === 'running' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : typeof step.icon === 'object' &&
                            step.icon !== null &&
                            'type' in step.icon ? (
                            <Sparkles className="w-4 h-4" />
                          ) : (
                            step.icon
                          )}
                        </div>
                        {index < steps.length - 1 && (
                          <div
                            className={`mt-1 w-px flex-1 ${step.status === 'done' ? 'bg-[var(--mint-strong)]' : 'bg-gray-200'}`}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-2">
                        <div
                          className={`text-[13px] font-bold ${
                            step.status === 'pending'
                              ? 'text-[var(--app-text-soft)]'
                              : 'text-[var(--app-ink)]'
                          }`}
                        >
                          {step.title}
                        </div>
                        {step.summary && step.status !== 'pending' && (
                          <div className="mt-1 text-[11px] font-bold leading-relaxed text-[var(--app-text)]">
                            {step.summary}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
