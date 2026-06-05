import React from 'react';
import {
  CloudSun,
  UtensilsCrossed,
  Coffee,
  Ticket,
  ClipboardPaste,
  CarTaxiFront,
} from 'lucide-react';

export interface QuickServiceShortcut {
  label: string;
  prompt: string;
  icon: React.ReactNode;
  accent: {
    iconBg: string;
    iconText: string;
    border: string;
    glow: string;
  };
}

const quickServiceShortcuts: QuickServiceShortcut[] = [
  {
    label: '天气',
    prompt: '帮我查一下现在的天气，顺便告诉我穿什么。',
    icon: <CloudSun className="w-4 h-4" />,
    accent: {
      iconBg: 'bg-[var(--sky-soft)]',
      iconText: 'text-[var(--sky-ink)]',
      border: 'border-[var(--sky-strong)]',
      glow: 'shadow-[0_10px_24px_rgba(107,125,152,0.08)]',
    },
  },
  {
    label: '找餐厅',
    prompt: '帮我找一家附近适合现在去吃的餐厅。',
    icon: <UtensilsCrossed className="w-4 h-4" />,
    accent: {
      iconBg: 'bg-[var(--peach-soft)]',
      iconText: 'text-[var(--peach-ink)]',
      border: 'border-[var(--peach-strong)]',
      glow: 'shadow-[0_10px_24px_rgba(217,139,76,0.08)]',
    },
  },
  {
    label: '点外卖',
    prompt: '我想点外卖，帮我推荐几家高分且送得快的。',
    icon: <Coffee className="w-4 h-4" />,
    accent: {
      iconBg: 'bg-[var(--rose-soft)]',
      iconText: 'text-[var(--rose-ink)]',
      border: 'border-[var(--rose-strong)]',
      glow: 'shadow-[0_10px_24px_rgba(201,75,134,0.08)]',
    },
  },
  {
    label: '找活动',
    prompt: '帮我找一下最近值得去的展览、演出或者门票活动。',
    icon: <Ticket className="w-4 h-4" />,
    accent: {
      iconBg: 'bg-[var(--mint-soft)]',
      iconText: 'text-[var(--mint-ink)]',
      border: 'border-[var(--mint-strong)]',
      glow: 'shadow-[0_10px_24px_rgba(42,162,122,0.08)]',
    },
  },
  {
    label: '领优惠',
    prompt: '帮我找一下现在能用的优惠券和折扣。',
    icon: <ClipboardPaste className="w-4 h-4" />,
    accent: {
      iconBg: 'bg-[var(--brand-soft)]',
      iconText: 'text-[var(--brand-ink)]',
      border: 'border-[#ffe2a3]',
      glow: 'shadow-[0_10px_24px_rgba(255,200,58,0.12)]',
    },
  },
  {
    label: '去打车',
    prompt: '我想打车，帮我叫一辆车。',
    icon: <CarTaxiFront className="w-4 h-4" />,
    accent: {
      iconBg: 'bg-[var(--warning-soft)]',
      iconText: 'text-[var(--warning-ink)]',
      border: 'border-amber-400',
      glow: 'shadow-[0_10px_24px_rgba(245,158,11,0.08)]',
    },
  },
];

interface QuickServiceShortcutsProps {
  onSelect: (prompt: string) => void;
}

export default function QuickServiceShortcuts({ onSelect }: QuickServiceShortcutsProps) {
  return (
    <div className="-mx-5 mb-3 overflow-x-auto scrollbar-none px-5">
      <div className="flex gap-2 min-w-max pb-1 pr-5">
        {quickServiceShortcuts.map((shortcut) => (
          <button
            key={shortcut.label}
            onClick={() => onSelect(shortcut.prompt)}
            className={`group flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-white/96 px-3 pr-3 text-left active:scale-[0.98] ${shortcut.accent.border} ${shortcut.accent.glow}`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${shortcut.accent.iconBg} ${shortcut.accent.iconText}`}
            >
              {shortcut.icon}
            </span>
            <span className={`text-[11px] font-semibold leading-none ${shortcut.accent.iconText}`}>
              {shortcut.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
