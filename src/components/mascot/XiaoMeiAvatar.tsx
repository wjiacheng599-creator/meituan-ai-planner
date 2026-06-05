/**
 * XiaoMeiAvatar - 小美 IP 形象组件
 *
 * 统一渲染小美表情 PNG，支持多种尺寸和动画。
 * PNG 素材位于 /public/mascot/{mood}.png
 */
import { motion, type MotionProps } from 'motion/react';
import React from 'react';

/** 小美支持的所有表情/姿态 */
export type XiaoMeiMood =
  | 'smile'
  | 'wink'
  | 'happy'
  | 'laugh'
  | 'thinking'
  | 'surprised'
  | 'sad'
  | 'cheer'
  | 'thumbsup'
  | 'ok'
  | 'greeting'
  | 'love'
  | 'effort'
  | 'angry'
  | 'side1'
  | 'side2'
  | 'working'
  | 'reading'
  | 'coffee'
  | 'shopping'
  | 'idea';

/** 尺寸预设 */
const SIZE_MAP: Record<string, string> = {
  xs: 'w-12 h-12',
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-44 h-44',
  '2xl': 'w-56 h-56',
};

export interface XiaoMeiAvatarProps {
  /** 表情/姿态类型 */
  mood?: XiaoMeiMood;
  /** 尺寸预设名，或传入 Tailwind 宽高 class 字符串 */
  size?: keyof typeof SIZE_MAP | string;
  /** 是否播放悬浮动画 */
  animate?: boolean;
  /** 额外 class */
  className?: string;
  /** 图片 alt 文本 */
  alt?: string;
}

/**
 * 获取小美在当前场景下推荐的表情
 */
export function getMoodForScene(
  scene: 'greeting' | 'thinking' | 'working' | 'success' | 'error' | 'idle'
): XiaoMeiMood {
  switch (scene) {
    case 'greeting':
      return 'smile';
    case 'thinking':
      return 'thinking';
    case 'working':
      return 'working';
    case 'success':
      return 'cheer';
    case 'error':
      return 'sad';
    case 'idle':
    default:
      return 'smile';
  }
}

const XiaoMeiAvatar = React.memo(function XiaoMeiAvatar({
  mood = 'smile',
  size = 'md',
  animate = false,
  className = '',
  alt = '小美',
}: XiaoMeiAvatarProps) {
  const sizeClass = SIZE_MAP[size] ?? size;
  const src = `/mascot/${mood}.png`;

  const imgEl = (
    <img
      src={src}
      alt={alt}
      className={`object-contain select-none pointer-events-none ${sizeClass} ${className}`}
      draggable={false}
    />
  );

  if (animate) {
    return (
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        className="inline-flex items-center justify-center"
      >
        {imgEl}
      </motion.div>
    );
  }

  return imgEl;
});

export default XiaoMeiAvatar;
