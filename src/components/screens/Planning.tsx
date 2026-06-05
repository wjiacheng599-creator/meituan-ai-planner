/**
 * Planning - AI 生成行程的进度展示页
 * SSE 流式驱动：实时展示 AI 生成进度，消除 30s 盲等
 */
import { motion } from 'motion/react';
import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Check, Clock, AlertCircle } from 'lucide-react';
import XiaoMeiAvatar from '../mascot/XiaoMeiAvatar';

interface PlanningProps {
  onBack?: () => void;
  onCancel?: () => void;
  streamingText?: string;
  isStreaming?: boolean;
  onStartStream?: (
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (err: string) => void
  ) => void;
}

const STEPS = [
  { id: 's1', label: '理解你的需求', keywords: ['分析', '识别', '需求', '偏好'] },
  { id: 's2', label: '寻找合适的地点', keywords: ['搜索', '景点', '目的地', 'POI'] },
  { id: 's3', label: '规划行程路线', keywords: ['路线', '行程', '安排', '规划'] },
  { id: 's4', label: '筛选优质商家', keywords: ['餐厅', '美食', '商家', '咖啡'] },
  { id: 's5', label: '计算预算与时间', keywords: ['预算', '价格', '费用'] },
  { id: 's6', label: '生成完整方案', keywords: ['完成', '方案', 'activities', 'title'] },
];

function parseProgressFromStream(text: string): number {
  if (!text || text.length === 0) return 0;
  if (text.includes('"activities"') && text.includes('"title"')) return 5;
  if (text.includes('"activities"')) return 4;
  if (text.includes('"totalPrice"') || text.includes('"price"')) return 4;
  if (text.includes('"summary"') || text.includes('"durationTags"')) return 3;
  if (text.length > 500) return 3;
  if (text.length > 200) return 2;
  if (text.length > 50) return 1;
  return 0;
}

export default function Planning({
  onBack,
  onCancel,
  streamingText = '',
  isStreaming = false,
  onStartStream,
}: PlanningProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [streamText, setStreamText] = useState('');

  const displayText = streamingText || streamText;
  const isActive = isStreaming || !!onStartStream;

  // 基于 streamingText 的真实进度追踪
  useEffect(() => {
    if (displayText) {
      const parsedStep = parseProgressFromStream(displayText);
      setCurrentStep((prev) => Math.max(prev, parsedStep));
    }
  }, [displayText]);

  // 降级模式：无 streaming 时用定时器推进步骤（2.5s/步）
  useEffect(() => {
    if (displayText) return;
    const timer = setInterval(() => {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, 2500);
    return () => clearInterval(timer);
  }, [displayText]);

  // 已等待计时器（始终运行）
  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // SSE 流式连接
  useEffect(() => {
    if (!onStartStream) return;
    let cancelled = false;
    onStartStream(
      (chunk: string) => {
        if (!cancelled) setStreamText((prev) => prev + chunk);
      },
      () => {
        if (!cancelled) setCurrentStep(STEPS.length);
      },
      (err: string) => {
        if (!cancelled) console.error('[Planning] SSE error:', err);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [onStartStream]);

  const handleCancel = useCallback(() => {
    if (onCancel) onCancel();
    else onBack?.();
  }, [onCancel, onBack]);

  const formatSeconds = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}分${sec}秒` : `${sec}秒`;
  };

  return (
    <div className="app-shell flex h-full flex-col">
      <div className="relative flex items-center px-5 pt-14 pb-4">
        <button
          onClick={handleCancel}
          className="app-pill absolute left-5 flex h-10 w-10 items-center justify-center rounded-full"
        >
          <ChevronLeft className="w-7 h-7 text-[var(--app-ink)]" />
        </button>
        <span className="flex-1 text-center text-[18px] font-semibold text-[var(--app-ink)]">
          {displayText ? '正在为你智能规划中...' : '小美正在为你规划...'}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center px-10 pt-10">
        {/* 小美形象 */}
        <div className="relative w-40 h-40 mb-14 mt-4 flex items-center justify-center">
          <div className="w-36 h-36 rounded-full bg-white/90 border border-[var(--app-border)] shadow-lg flex items-center justify-center">
            <XiaoMeiAvatar mood="working" size="lg" />
          </div>
        </div>

        {/* 已等待时间（温和提示） */}
        <div className="flex items-center gap-1.5 mb-6">
          <Clock className="w-3.5 h-3.5 text-[var(--app-text-soft)]" />
          <span className="text-[13px] text-[var(--app-text-soft)]">
            {displayText
              ? `已等待 ${formatSeconds(elapsedSeconds)} · 已生成 ${displayText.length} 字符`
              : `已等待 ${formatSeconds(elapsedSeconds)} · 正在连接 AI...`}
          </span>
        </div>

        {/* 进度步骤 */}
        <div className="app-card w-full max-w-[260px] space-y-5 rounded-[24px] px-6 py-6">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center space-x-4"
              >
                <div
                  className={`flex h-[22px] w-[22px] items-center justify-center rounded-full transition-colors duration-500 ${
                    isCompleted
                      ? 'bg-[var(--mint-ink)]'
                      : isCurrent && displayText
                        ? 'bg-[var(--brand)] animate-pulse'
                        : 'bg-[var(--app-border)]'
                  }`}
                >
                  {isCompleted && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                  {isCurrent && !isCompleted && displayText && (
                    <div className="w-2 h-2 rounded-full bg-[var(--brand-ink)]" />
                  )}
                </div>
                <span
                  className={`text-[15px] transition-colors duration-500 ${
                    isCompleted
                      ? 'font-medium text-[var(--app-ink)]'
                      : isCurrent
                        ? 'font-bold text-[var(--brand-ink)]'
                        : 'text-[var(--app-text-soft)]'
                  }`}
                >
                  {step.label}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* 实时流式内容预览 */}
        {displayText && (
          <div className="w-full max-w-[320px] mt-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-[var(--brand)] rounded-full animate-bounce" />
              <span className="text-xs text-[var(--app-text)]">AI 正在生成...</span>
            </div>
            <div className="p-3 app-card rounded-2xl bg-[var(--app-card-soft)]/80">
              <pre className="text-xs text-[var(--app-ink)] whitespace-pre-wrap font-mono leading-relaxed max-h-24 overflow-y-auto">
                {displayText.slice(-300)}
                <span className="inline-block w-1.5 h-3.5 bg-[var(--brand)] ml-0.5 animate-pulse" />
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center p-8">
        <p className="text-[13px] text-[var(--app-text-soft)] mb-6">
          {displayText ? 'AI 正在生成方案，请稍候...' : '等待 AI 响应中...'}
        </p>
        <button
          onClick={handleCancel}
          className="app-btn-ghost rounded-full px-8 py-2.5 text-sm font-medium hover:bg-[var(--app-card-soft)]"
        >
          取消
        </button>
      </div>
    </div>
  );
}
