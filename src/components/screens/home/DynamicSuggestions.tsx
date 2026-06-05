import React from 'react';
import { motion } from 'motion/react';

export interface DynamicSuggestionCard {
  icon: React.ReactNode;
  title: string;
  desc: string;
  prompt: string;
  topicKey: string;
}

export function getSuggestionAccent(topicKey: string, fallbackIndex: number) {
  const palette: Record<string, { border: string; iconText: string; iconBg: string }> = {
    family: {
      border: 'var(--rose-strong)',
      iconText: 'var(--rose-ink)',
      iconBg: 'var(--rose-soft)',
    },
    elder: {
      border: 'var(--mint-strong)',
      iconText: 'var(--mint-ink)',
      iconBg: 'var(--mint-soft)',
    },
    couple: {
      border: 'var(--rose-strong)',
      iconText: 'var(--rose-ink)',
      iconBg: 'var(--rose-soft)',
    },
    group: { border: 'var(--sky-strong)', iconText: 'var(--sky-ink)', iconBg: 'var(--sky-soft)' },
    photo: {
      border: 'var(--rose-strong)',
      iconText: 'var(--rose-ink)',
      iconBg: 'var(--rose-soft)',
    },
    walk: { border: 'var(--mint-strong)', iconText: 'var(--mint-ink)', iconBg: 'var(--mint-soft)' },
    coffee: {
      border: 'var(--peach-strong)',
      iconText: 'var(--peach-ink)',
      iconBg: 'var(--peach-soft)',
    },
    evening: { border: 'var(--sky-strong)', iconText: 'var(--sky-ink)', iconBg: 'var(--sky-soft)' },
    afternoon: {
      border: 'var(--peach-strong)',
      iconText: 'var(--peach-ink)',
      iconBg: 'var(--peach-soft)',
    },
    execution: {
      border: 'var(--mint-strong)',
      iconText: 'var(--mint-ink)',
      iconBg: 'var(--mint-soft)',
    },
    'fresh-restart': {
      border: 'var(--sky-strong)',
      iconText: 'var(--sky-ink)',
      iconBg: 'var(--sky-soft)',
    },
    remix: { border: 'var(--sky-strong)', iconText: 'var(--sky-ink)', iconBg: 'var(--sky-soft)' },
    'repeat-style': {
      border: 'var(--peach-strong)',
      iconText: 'var(--peach-ink)',
      iconBg: 'var(--peach-soft)',
    },
    eat: {
      border: 'var(--peach-strong)',
      iconText: 'var(--peach-ink)',
      iconBg: 'var(--peach-soft)',
    },
    nearby: { border: 'var(--sky-strong)', iconText: 'var(--sky-ink)', iconBg: 'var(--sky-soft)' },
    fresh: {
      border: 'var(--rose-strong)',
      iconText: 'var(--rose-ink)',
      iconBg: 'var(--rose-soft)',
    },
    morning: { border: 'var(--peach-strong)', iconText: 'var(--peach-ink)', iconBg: 'var(--peach-soft)' },
    night: { border: 'var(--sky-strong)', iconText: 'var(--sky-ink)', iconBg: 'var(--sky-soft)' },
    weekend: { border: 'var(--mint-strong)', iconText: 'var(--mint-ink)', iconBg: 'var(--mint-soft)' },
    indoor: { border: 'var(--sky-strong)', iconText: 'var(--sky-ink)', iconBg: 'var(--sky-soft)' },
    warm: { border: 'var(--rose-strong)', iconText: 'var(--rose-ink)', iconBg: 'var(--rose-soft)' },
    cool: { border: 'var(--sky-strong)', iconText: 'var(--sky-ink)', iconBg: 'var(--sky-soft)' },
    foodie: { border: 'var(--peach-strong)', iconText: 'var(--peach-ink)', iconBg: 'var(--peach-soft)' },
    explore: { border: 'var(--mint-strong)', iconText: 'var(--mint-ink)', iconBg: 'var(--mint-soft)' },
    budget: { border: 'var(--mint-strong)', iconText: 'var(--mint-ink)', iconBg: 'var(--mint-soft)' },
    premium: { border: 'var(--rose-strong)', iconText: 'var(--rose-ink)', iconBg: 'var(--rose-soft)' },
    artsy: { border: 'var(--rose-strong)', iconText: 'var(--rose-ink)', iconBg: 'var(--rose-soft)' },
  };

  const fallback = [
    { border: 'var(--rose-strong)', iconText: 'var(--rose-ink)', iconBg: 'var(--rose-soft)' },
    { border: 'var(--sky-strong)', iconText: 'var(--sky-ink)', iconBg: 'var(--sky-soft)' },
    { border: 'var(--mint-strong)', iconText: 'var(--mint-ink)', iconBg: 'var(--mint-soft)' },
    { border: 'var(--peach-strong)', iconText: 'var(--peach-ink)', iconBg: 'var(--peach-soft)' },
  ];

  return palette[topicKey] || fallback[fallbackIndex % fallback.length];
}

interface DynamicSuggestionsProps {
  suggestionCards: DynamicSuggestionCard[];
  onSelect: (prompt: string) => void;
}

export default function DynamicSuggestions({ suggestionCards, onSelect }: DynamicSuggestionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="relative z-10 w-full pointer-events-auto"
    >
      <div className="mt-3 -mx-5 overflow-x-auto scrollbar-none px-5">
        <div
          className="grid grid-flow-col gap-2 snap-x snap-mandatory pb-2 pr-5"
          style={{ gridAutoColumns: 'minmax(150px, 170px)' }}
        >
          {suggestionCards.map((card, idx) => {
            const accent = getSuggestionAccent(card.topicKey, idx);
            return (
              <button
                key={`${card.topicKey}-${idx}`}
                type="button"
                onClick={() => onSelect(card.prompt)}
                className="relative z-10 flex w-full min-h-[140px] snap-start flex-col rounded-[24px] border-[3px] bg-white/92 px-3 py-4 text-left shadow-[0_6px_20px_rgba(20,24,33,0.04)] transition-transform active:scale-[0.98] pointer-events-auto"
                style={{ borderColor: accent.border, touchAction: 'manipulation' }}
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-[12px]"
                  style={{ backgroundColor: accent.iconBg, color: accent.iconText }}
                >
                  <div className="text-[18px]">{card.icon}</div>
                </div>
                <div className="mt-3 text-[15px] font-bold leading-[1.2] text-[var(--app-ink)] tracking-[-0.03em]">
                  {card.title}
                </div>
                <div className="mt-1.5 text-[11px] font-medium text-[var(--app-text)] leading-snug">
                  {card.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
