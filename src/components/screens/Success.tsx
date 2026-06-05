import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Activity } from '../../services/ai';
import { ChevronLeft, Lightbulb, Share2, Star } from 'lucide-react';
import GradientImg from '../ui/GradientImg';
import { StepIndicator, ORDER_STEPS } from '../ui/StepIndicator';
import XiaoMeiAvatar from '../mascot/XiaoMeiAvatar';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
}

interface SuccessProps {
  activity?: Activity | null;
  title?: string;
  orderId?: string;
  onBackToItinerary: () => void;
  onViewOrders?: () => void;
  onShare?: () => void;
  onBackHome?: () => void;
}

export default function Success({
  activity,
  title,
  orderId: serverOrderId,
  onBackToItinerary,
  onViewOrders,
  onShare,
}: SuccessProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const isBundled = !activity;
  const mainTitle = isBundled ? '打包预订成功！' : '预订成功！';
  const subtitle = isBundled ? '已为你锁定本次任务里的服务安排' : '已为您锁定名额';
  const orderDate = new Date();
  const formattedDate = `${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
  const orderId = useMemo(() => serverOrderId || Date.now().toString().slice(-10), [serverOrderId]);

  useEffect(() => {
    const colors = ['#0EA5E9', '#F97316', '#FCD34D', '#34D399', '#F472B6'];
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: Math.random() * 2 + 2,
      delay: Math.random() * 0.5,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="app-shell flex h-full flex-col bg-transparent relative overflow-hidden">
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{ opacity: 0, scale: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0, 1, 1, 0],
              y: [0, -100, -200],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              ease: 'easeOut',
            }}
            className="absolute pointer-events-none"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              borderRadius: '50%',
            }}
          />
        ))}
      </AnimatePresence>

      <div className="px-5 pt-14 pb-3 bg-transparent flex items-center shadow-none relative z-20 justify-center">
        <motion.button
          onClick={onBackToItinerary}
          className="w-8 h-8 flex items-center justify-start absolute left-5 cursor-pointer"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronLeft className="w-7 h-7 text-[var(--app-ink)]" />
        </motion.button>
      </div>

      <StepIndicator steps={ORDER_STEPS} currentStep={4} />

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center justify-center mb-8"
        >
          <motion.div
            className="w-20 h-20 bg-gradient-to-br from-[#0EA5E9] to-[#38BDF8] rounded-full flex items-center justify-center mb-5 shadow-[0_10px_40px_rgba(14,165,233,0.25)]"
            animate={{
              scale: [1, 1.08, 1],
              boxShadow: [
                '0 10px 40px rgba(14,165,233,0.25)',
                '0 15px 50px rgba(14,165,233,0.35)',
                '0 10px 40px rgba(14,165,233,0.25)',
              ],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <XiaoMeiAvatar mood="cheer" size="w-12 h-12" />
            </motion.div>
          </motion.div>
          <motion.h2
            className="text-2xl font-bold text-[#141821] mb-2 mt-2 text-center"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {mainTitle}
          </motion.h2>
          <motion.p
            className="text-sm text-[var(--app-text)] text-center"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {subtitle}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
          className="app-card rounded-[24px] p-5 mb-8 relative overflow-hidden shadow-lg border border-[var(--app-border)]"
        >
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {activity ? (
              <motion.div
                className="flex justify-between items-start mb-6"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div>
                  <h4 className="font-bold text-[var(--app-ink)] text-base">{activity.title}</h4>
                  <motion.div
                    className="flex items-center text-xs text-[var(--app-text)] mt-2"
                    initial={{ y: 5, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                  >
                    <span className="font-medium text-[var(--app-ink)]">{formattedDate}</span>
                    <span className="mx-2">·</span>
                    <span>{activity.timeLine || '已锁定当前时段'}</span>
                  </motion.div>
                  <motion.div
                    className="flex items-center text-xs text-[var(--app-text)] mt-1"
                    initial={{ y: 5, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.75 }}
                  >
                    <span className="font-medium text-[var(--app-ink)]">
                      {activity.description}
                    </span>
                  </motion.div>
                </div>
                <motion.div
                  className="w-16 h-16 bg-[var(--app-card-soft)] rounded-2xl overflow-hidden shrink-0 border-2 border-[var(--app-border)] shadow-md"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                >
                  <GradientImg
                    src={activity.imageUrl || 'gradient:green-teal'}
                    alt="ticket"
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4">
                <h4 className="font-bold text-[var(--app-ink)] text-[18px] mb-2">
                  {title || '多项服务打包预订成功'}
                </h4>
                <p className="text-[var(--app-text)] text-[13px] font-medium">
                  任务状态已更新，可在「我的行程」继续查看
                </p>
              </div>
            )}

            <motion.div
              className="flex items-center justify-between border-t border-dashed border-[var(--app-border)] pt-4 mt-2"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--app-text-soft)] mb-0.5">订单号</span>
                <span className="text-xs font-mono text-[var(--app-ink)]">{orderId}</span>
              </div>
              {activity && (
                <span className="text-lg font-bold text-[#F97316]">¥{activity.price}</span>
              )}
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          className="flex space-x-3 mb-10"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.0 }}
        >
          <motion.button
            onClick={onViewOrders}
            className="flex-1 app-btn-ghost font-bold py-3.5 rounded-2xl text-[15px] cursor-pointer border-2 border-[#0EA5E9] text-[#0EA5E9] hover:bg-[#0EA5E9] hover:text-white transition-all duration-300"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            查看订单
          </motion.button>
          <motion.button
            onClick={onShare}
            className="flex-1 app-btn-ghost font-bold py-3.5 rounded-2xl text-[15px] cursor-pointer border-2 border-[#F97316] text-[#F97316] hover:bg-[#F97316] hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02, y: -2, backgroundColor: '#F97316', color: 'white' }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <Share2 className="w-4 h-4" />
            分享给家人
          </motion.button>
        </motion.div>

        <motion.div
          className="rounded-[24px] border-2 border-[#FED7AA] bg-gradient-to-br from-[#FFF7ED] to-[#FFEDD5] p-5 flex items-start shadow-md"
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
        >
          <motion.div
            className="w-10 h-10 bg-gradient-to-br from-[#F97316] to-[#FB923C] rounded-xl flex items-center justify-center mr-4 mt-0.5 shrink-0 shadow-md"
            whileHover={{ rotate: 15 }}
            transition={{ duration: 0.2 }}
          >
            <Lightbulb className="w-5 h-5 text-white" />
          </motion.div>
          <div className="flex-1">
            <motion.h5
              className="font-bold text-[var(--app-ink)] text-sm mb-2 flex items-center gap-2"
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              <Star className="w-4 h-4 text-[#F97316] fill-current" />
              温馨提示
            </motion.h5>
            <motion.p
              className="text-[13px] text-[var(--app-text)] leading-relaxed"
              initial={{ y: 5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.3 }}
            >
              周末人流量较大，建议提前15分钟到达场馆。如需改签或退票请于游玩前2小时操作。
            </motion.p>
          </div>
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-0 left-0 right-0 p-5 bg-white/90 backdrop-blur-xl border-t border-[var(--app-border)] flex pb-safe z-30 justify-center shadow-[0_-8px_30px_rgba(20,24,33,0.08)]"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
      >
        <motion.button
          onClick={onBackToItinerary}
          className="app-btn-primary w-full font-bold py-4 rounded-2xl transition-all duration-300 text-lg cursor-pointer shadow-lg hover:shadow-xl"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          返回行程
        </motion.button>
      </motion.div>
    </div>
  );
}
