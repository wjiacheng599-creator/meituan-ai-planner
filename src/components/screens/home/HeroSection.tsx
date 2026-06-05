import React from 'react';
import { motion } from 'motion/react';
import type { DynamicSuggestionCard } from './DynamicSuggestions';
import DynamicSuggestions from './DynamicSuggestions';
import XiaoMeiAvatar from '../../mascot/XiaoMeiAvatar';

interface HeroSectionProps {
  greeting: string;
  mainUserName: string;
  suggestionCards: DynamicSuggestionCard[];
  onStartPlan: (prompt: string) => void;
}

const HeroSection = React.memo(function HeroSection({
  greeting,
  mainUserName,
  suggestionCards,
  onStartPlan,
}: HeroSectionProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[450px]">
      {/* Avatar Area */}
      <div className="mb-6 flex items-center justify-center">
        <img
          src="/mascot/xiaomei-main.png"
          alt="小美"
          className="w-28 h-28 object-contain"
          draggable={false}
        />
      </div>

      {/* Greeting Typography */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
        className="text-center mb-[60px]"
      >
        <h1 className="text-[28px] font-bold text-[#141821] tracking-tight mb-2 opacity-95">
          {greeting}，{mainUserName || '小明'}！
        </h1>
        <p className="text-[15px] font-semibold text-[#7b8493]">去哪里探索，想玩什么？</p>
      </motion.div>

      {/* Suggestion Cards */}
      <DynamicSuggestions suggestionCards={suggestionCards} onSelect={onStartPlan} />
    </div>
  );
});

export default HeroSection;
