import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Variants } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Coffee,
  MapPin,
  Camera,
  Footprints,
  Utensils,
  Compass,
  Heart,
  Sparkles,
} from 'lucide-react';
import XiaoMeiAvatar from '../mascot/XiaoMeiAvatar';
import { CharacterAnimation } from '../ui/CharacterAnimation';

interface OnboardingProps {
  onComplete: () => void;
}

const OnboardingStep = {
  SPLASH: 0,
  WELCOME: 1,
  EXPLORE: 2,
  SHARE: 3,
  READY: 4,
};

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(OnboardingStep.SPLASH);
  const [direction, setDirection] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 自动从splash页跳转
  useEffect(() => {
    if (step === OnboardingStep.SPLASH) {
      timerRef.current = setTimeout(() => {
        setStep(OnboardingStep.WELCOME);
      }, 2000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step]);

  const handleNext = () => {
    if (step < OnboardingStep.READY) {
      setDirection(1);
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (step > OnboardingStep.WELCOME) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#fbfcff] overflow-hidden">
      <AnimatePresence mode="wait">
        {step === OnboardingStep.SPLASH && <SplashScreen key="splash" />}

        {step === OnboardingStep.WELCOME && (
          <OnboardingSlide
            key="welcome"
            direction={direction}
            title="你好，我是小美"
            subtitle="你的本地生活智能小帮手"
            mascotSrc="/mascot/greeting.png"
            description="找咖啡馆、周末出游、朋友聚餐，告诉我你想做什么，我来安排。"
            accentColor="from-[#ffe7f1] to-[#fff4bf]"
            stepIndex={0}
            totalSteps={4}
            floatingIcons={[
              { icon: <Coffee className="w-5 h-5 text-[#d98b4c]" />, pos: '-top-5 -right-8' },
              { icon: <MapPin className="w-4.5 h-4.5 text-[#c94b86]" />, pos: 'top-14 -right-12' },
              { icon: <Footprints className="w-5 h-5 text-[#2aa27a]" />, pos: '-bottom-2 -left-8' },
            ]}
            onNext={handleNext}
            onSkip={handleSkip}
            showBack={false}
          />
        )}

        {step === OnboardingStep.EXPLORE && (
          <OnboardingSlide
            key="explore"
            direction={direction}
            title="一句话，规划行程"
            subtitle="AI 懂你要什么"
            mascotSrc="/mascot/idea.png"
            description="说出你的想法，我来搜真实地点、查天气、优化路线。"
            accentColor="from-[#eef8f1] to-[#f2f5fb]"
            stepIndex={1}
            totalSteps={4}
            floatingIcons={[
              { icon: <Sparkles className="w-5 h-5 text-[#ffd84d]" />, pos: '-top-5 -right-8' },
              { icon: <Compass className="w-4.5 h-4.5 text-[#6b7d98]" />, pos: 'top-14 -right-12' },
              { icon: <MapPin className="w-5 h-5 text-[#2aa27a]" />, pos: '-bottom-2 -left-8' },
            ]}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
            showBack
          />
        )}

        {step === OnboardingStep.SHARE && (
          <OnboardingSlide
            key="share"
            direction={direction}
            title="记录每次出行"
            subtitle="回忆不会走丢"
            mascotSrc="/mascot/love.png"
            description="打卡拍照、生成旅行故事，每次出行都值得被记住。"
            accentColor="from-[#ffe7f1] to-[#fff4bf]"
            stepIndex={2}
            totalSteps={4}
            floatingIcons={[
              { icon: <Camera className="w-5 h-5 text-[#c94b86]" />, pos: '-top-5 -right-8' },
              { icon: <Heart className="w-4.5 h-4.5 text-[#e85d75]" />, pos: 'top-14 -right-12' },
              { icon: <Sparkles className="w-5 h-5 text-[#ffd84d]" />, pos: '-bottom-2 -left-8' },
            ]}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
            showBack
          />
        )}

        {step === OnboardingStep.READY && (
          <OnboardingSlide
            key="ready"
            direction={direction}
            title="准备好了吗"
            subtitle="一起出发吧！"
            mascotSrc="/mascot/cheer.png"
            description="现在就想出门，还是提前规划周末，小美都在。"
            accentColor="from-[#f2f5fb] to-[#eef8f1]"
            stepIndex={3}
            totalSteps={4}
            floatingIcons={[
              { icon: <Utensils className="w-5 h-5 text-[#d98b4c]" />, pos: '-top-5 -right-8' },
              { icon: <Footprints className="w-4.5 h-4.5 text-[#2aa27a]" />, pos: 'top-14 -right-12' },
              { icon: <Compass className="w-5 h-5 text-[#6b7d98]" />, pos: '-bottom-2 -left-8' },
            ]}
            isLastStep
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
            showBack
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: `
          radial-gradient(circle at 20% 30%, rgba(168, 160, 216, 0.18), transparent 35%),
          radial-gradient(circle at 80% 20%, rgba(200, 180, 240, 0.12), transparent 30%),
          radial-gradient(circle at 50% 80%, rgba(220, 210, 250, 0.15), transparent 40%),
          linear-gradient(180deg, #faf9ff 0%, #f8f7fc 50%, #f5f4fa 100%)
        `,
      }}
    >
      {/* 装饰元素 */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.8, type: 'spring' }}
        className="absolute top-[15%] right-[15%] w-3 h-3 rounded-full bg-[#c8a8e8]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.8, type: 'spring' }}
        className="absolute top-[25%] left-[12%] w-2 h-2 rounded-full bg-[#a8c8e8]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6, duration: 0.8, type: 'spring' }}
        className="absolute bottom-[28%] right-[18%] w-2.5 h-2.5 rounded-full bg-[#e8c8a8]"
      />

      {/* 主内容区域 */}
      <div className="relative z-10 flex flex-col items-center -mt-2">
        {/* 动画角色 */}
        <motion.div
          initial={{ scale: 0.7, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 0.9, type: 'spring', bounce: 0.25 }}
          className="relative"
        >
          <div className="absolute -inset-8 rounded-full bg-gradient-to-br from-[rgba(200,180,240,0.15)] to-[rgba(168,200,240,0.1)] blur-2xl" />
          <CharacterAnimation autoPlay loop className="w-44 h-44 mx-auto relative z-10" />
        </motion.div>

        {/* 品牌名称 */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="mt-10"
        >
          <img
            src="/xiaomei-text.png"
            alt="小美"
            className="h-14 w-auto object-contain"
            style={{
              filter: 'drop-shadow(0 2px 12px rgba(30, 27, 75, 0.1))',
            }}
          />
        </motion.div>

        {/* Slogan */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="mt-4"
        >
          <p
            className="text-[15px] font-medium"
            style={{
              fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
              color: '#6b6688',
              letterSpacing: '0.35em',
            }}
          >
            你的本地生活智能小帮手
          </p>
        </motion.div>

        {/* 装饰线 */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.75, duration: 0.8 }}
          className="mt-6 w-12 h-[2px] rounded-full bg-gradient-to-r from-[#c8a8e8] to-[#a8c8e8]"
        />
      </div>

      {/* 底部加载动画 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.6 }}
        className="absolute bottom-24"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
            className="w-1.5 h-1.5 rounded-full bg-[#8b7fc8]"
          />
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            className="w-1.5 h-1.5 rounded-full bg-[#8b7fc8]"
          />
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
            className="w-1.5 h-1.5 rounded-full bg-[#8b7fc8]"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

interface FloatingIcon {
  icon: React.ReactNode;
  pos: string;
}

interface OnboardingSlideProps {
  title: string;
  subtitle: string;
  description: string;
  mascotSrc: string;
  accentColor: string;
  floatingIcons?: FloatingIcon[];
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  onBack?: () => void;
  showBack: boolean;
  direction: number;
  isLastStep?: boolean;
}

function OnboardingSlide({
  title,
  subtitle,
  description,
  mascotSrc,
  accentColor,
  floatingIcons = [],
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
  onBack,
  showBack,
  direction,
  isLastStep = false,
}: OnboardingSlideProps) {
  const slideVariants: Variants = {
    hidden: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.96,
    }),
    visible: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      transition: { duration: 0.3 },
    },
  };

  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="absolute inset-0 flex flex-col"
      style={{
        background: `
          radial-gradient(circle at top left, rgba(255, 210, 227, 0.22), transparent 28%),
          radial-gradient(circle at top right, rgba(164, 184, 216, 0.16), transparent 24%),
          linear-gradient(180deg, #fffcf9 0%, #fbfcff 45%, #f6f7fb 100%)
        `,
      }}
    >
      <div className="flex items-center justify-between px-5 pt-14 pb-3">
        {showBack ? (
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/82 border border-[#e7ebf3] flex items-center justify-center active:scale-95 transition-transform shadow-sm"
          >
            <ArrowRight className="w-4.5 h-4.5 text-[#141821] rotate-180" />
          </button>
        ) : (
          <div className="w-10" />
        )}

        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= stepIndex ? 'w-6 bg-[#ffd84d]' : 'w-2 bg-[#d9e0ec]'
              }`}
            />
          ))}
        </div>

        {!isLastStep ? (
          <button
            onClick={onSkip}
            className="px-3 py-1.5 rounded-full text-[13px] font-bold text-[#606978] active:scale-95 transition-transform"
          >
            跳过
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      <div className="flex-1 flex flex-col px-5">
        <div className="flex-1 flex items-center justify-center pb-6">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="relative"
          >
            <div
              className={`absolute -inset-6 rounded-[40px] bg-gradient-to-br ${accentColor} opacity-60 blur-2xl`}
            />
            <div className="relative w-36 h-36 rounded-[36px] bg-white/92 border border-white/60 shadow-[0_20px_48px_rgba(21,24,33,0.08)] flex items-center justify-center overflow-hidden">
              <motion.img
                src={mascotSrc}
                alt="小美"
                className="w-28 h-28 object-contain"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5, type: 'spring' }}
              />
            </div>

            {floatingIcons.map((fi, i) => (
              <motion.div
                key={i}
                animate={{
                  y: [0, i === 0 ? -8 : i === 1 ? 0 : 6, 0],
                  x: [0, i === 0 ? 4 : i === 1 ? 0 : -4, 0],
                  scale: i === 1 ? [1, 1.05, 1] : 1,
                }}
                transition={{
                  duration: 3.5 + i * 0.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.25,
                }}
                className={`absolute ${fi.pos} w-11 h-11 rounded-xl bg-white shadow-md flex items-center justify-center border border-[#e7ebf3]`}
              >
                {fi.icon}
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
          >
            <p className="text-[13px] font-bold text-[#606978] tracking-wide mb-2">{subtitle}</p>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="text-[28px] font-bold text-[#141821] leading-tight tracking-tight"
          >
            {title}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
            className="mt-3 text-[15px] font-medium text-[#606978] leading-relaxed"
          >
            {description}
          </motion.p>
        </div>
      </div>

      <div className="px-5 pb-8">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.6 }}
          onClick={onNext}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#ffd84d] to-[#ffc83a] text-[#3b2b00] text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-[0_14px_40px_rgba(255,200,58,0.3)]"
        >
          {isLastStep ? (
            <>
              <CheckCircle2 className="w-4.5 h-4.5" />
              <span>开始使用</span>
            </>
          ) : (
            <>
              <span>继续</span>
              <ArrowRight className="w-4.5 h-4.5" />
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
