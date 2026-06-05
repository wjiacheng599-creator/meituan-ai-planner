import React, { useState, useEffect, useRef } from 'react';

interface CharacterAnimationProps {
  /** 是否自动播放 */
  autoPlay?: boolean;
  /** 是否循环播放 */
  loop?: boolean;
  /** 额外CSS类名 */
  className?: string;
  /** 动画播放完成回调 */
  onComplete?: () => void;
  /** 点击事件 */
  onClick?: () => void;
}

/**
 * Q版治愈系人物动画组件
 * 支持 WebP 和 GIF 两种格式
 * 注意：WebP/GIF 动画会自动播放，无需额外属性
 */
export function CharacterAnimation({
  autoPlay = true,
  loop = true,
  className = '',
  onComplete,
  onClick,
}: CharacterAnimationProps) {
  const [useWebP, setUseWebP] = useState(true); // 优先使用WebP
  const imgRef = useRef<HTMLImageElement>(null);

  // 切换格式（如果WebP不支持）
  const handleError = () => {
    if (useWebP) {
      console.warn('WebP动画加载失败，切换到GIF版本');
      setUseWebP(false);
    }
  };

  const src = useWebP
    ? '/animations/character-animation.webp'
    : '/animations/character-animation.gif';

  return (
    <div
      className={`relative inline-block ${className}`}
      onClick={onClick}
      style={{ background: 'transparent' }}
    >
      <img
        ref={imgRef}
        src={src}
        alt="Q版治愈系人物动画"
        className="w-full h-auto object-contain"
        style={{
          background: 'transparent',
          maxWidth: '100%',
          height: 'auto',
        }}
        onError={handleError}
      />
    </div>
  );
}

/**
 * 全屏动画弹窗组件
 */
interface AnimationModalProps {
  /** 是否显示 */
  show: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 动画尺寸 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function AnimationModal({ show, onClose, size = 'md' }: AnimationModalProps) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl p-8 ${sizeMap[size]} mx-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">🎬 人物动画</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center justify-center min-h-[300px]">
          <CharacterAnimation autoPlay loop className="w-64 h-64" />
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
