import { Loader2 } from 'lucide-react';
import XiaoMeiAvatar from '../mascot/XiaoMeiAvatar';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

const TEXT_SIZES = {
  sm: 'text-[11px]',
  md: 'text-[13px]',
  lg: 'text-[13px]',
};

export function Loading({ size = 'md', text, className = '' }: LoadingProps) {
  const sizeMap: Record<string, string> = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };
  const moodMap: Record<string, string> = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };
  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div className={sizeMap[size]}>
        <XiaoMeiAvatar mood="thinking" size={moodMap[size]} />
      </div>
      {text && <span className={`${TEXT_SIZES[size]} font-bold text-gray-400`}>{text}</span>}
    </div>
  );
}

export function FullPageLoading({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <Loading size="lg" text={text} />
    </div>
  );
}

export function LoadingOverlay({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <Loading size="md" text={text} />
    </div>
  );
}
