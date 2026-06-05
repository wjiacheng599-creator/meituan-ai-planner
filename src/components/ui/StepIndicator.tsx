import { Check, type LucideIcon } from 'lucide-react';

interface Step {
  label: string;
  icon?: LucideIcon;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className = '' }: StepIndicatorProps) {
  return (
    <div className={`flex items-center justify-center gap-1 px-4 py-3 ${className}`}>
      {steps.map((step, idx) => {
        const stepNum = idx + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;
        const isPending = stepNum > currentStep;

        return (
          <div key={step.label} className="flex items-center gap-1">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                  isCompleted
                    ? 'bg-[var(--mint-ink)] text-white'
                    : isCurrent
                      ? 'bg-[var(--brand-ink)] text-white ring-2 ring-[var(--brand-ink)] ring-offset-1'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : stepNum}
              </div>
              <span
                className={`text-[11px] font-bold ${
                  isCompleted
                    ? 'text-[var(--mint-ink)]'
                    : isCurrent
                      ? 'text-[var(--brand-ink)]'
                      : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-6 h-0.5 rounded-full transition-colors ${
                  isCompleted ? 'bg-[var(--mint-ink)]' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export const ORDER_STEPS: Step[] = [
  { label: '选品' },
  { label: '确认' },
  { label: '支付' },
  { label: '完成' },
];
