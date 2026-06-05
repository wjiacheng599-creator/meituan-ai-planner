import { motion, AnimatePresence } from 'motion/react';
import type { Variants } from 'motion/react';
import type { Activity } from '../../services/ai';
import { ChevronLeft, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { StepIndicator, ORDER_STEPS } from '../ui/StepIndicator';
import { ensureAuth, processPayment } from '../../services/serverApi';

interface PaymentProps {
  activity?: Activity | null;
  amount?: number;
  title?: string;
  serviceCount?: number;
  planId?: string;
  activityIds?: string[];
  merchantName?: string;
  onBack: () => void;
  onPaySuccess: (payment?: { paymentId?: string; orderId?: string }) => void;
}

type PaymentMethod = 'meituan' | 'wechat' | 'alipay';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
};

const paymentMethodVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

const errorVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -10,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.95,
    transition: {
      duration: 0.2,
    },
  },
};

export default function Payment({
  activity,
  amount,
  title,
  serviceCount,
  planId,
  activityIds,
  merchantName,
  onBack,
  onPaySuccess,
}: PaymentProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('meituan');
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const finalAmount = amount ?? activity?.price ?? 0;
  const finalTitle = title || (activity ? activity.title : '合并付款订单');
  const finalServiceCount = serviceCount ?? 1;
  const amountText = finalAmount.toFixed(2);
  const [amountInteger, amountDecimal] = amountText.split('.');

  const handlePay = async () => {
    setIsPaying(true);
    setPayError(null);

    try {
      // 确保用户已认证
      await ensureAuth();

      const payment = await processPayment({
        amount: finalAmount,
        method: selectedMethod,
        orderTitle: finalTitle,
        planId: planId || undefined,
        activityIds: activityIds || [],
        merchantName: merchantName || '未知商家',
      });

      if (!payment.success || !payment.paymentId) {
        throw new Error(payment.message || '支付失败，请重试');
      }

      onPaySuccess({ paymentId: payment.paymentId, orderId: payment.orderId });
    } catch (err) {
      const message = err instanceof Error ? err.message : '支付失败，请重试';
      // DOMException aborted → 超时特定提示
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        setPayError('请求超时，请检查网络后重试');
      } else {
        setPayError(message);
      }
      return; // 不调用 onPaySuccess，留在支付页让用户重试
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-transparent">
      <motion.div
        className="px-5 pt-14 pb-3 bg-white/78 backdrop-blur-xl flex items-center shadow-[0_6px_18px_rgba(20,24,33,0.04)] relative z-20 justify-center border-b border-[var(--app-border)]"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-start absolute left-5 cursor-pointer"
        >
          <ChevronLeft className="w-7 h-7 text-[var(--app-ink)] transition-all" />
        </button>
        <span className="font-bold text-lg text-[#141821]">美团支付</span>
      </motion.div>

      <StepIndicator steps={ORDER_STEPS} currentStep={3} />

      <motion.div
        className="flex-1 overflow-y-auto px-5 pt-4 pb-32"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          className="app-card flex flex-col items-center justify-center py-10 mb-3 rounded-[24px]"
          variants={itemVariants}
        >
          <div className="flex items-baseline mb-2">
            <span className="text-2xl font-bold text-[#141821] mr-1">¥</span>
            <span className="text-5xl font-bold text-[#141821] tracking-tight">
              {amountInteger}
            </span>
            <span className="text-2xl font-bold text-[#141821]">.{amountDecimal}</span>
          </div>

          <motion.div
            className="mt-8 app-card-soft rounded-2xl w-[90%] p-4 flex flex-col space-y-3"
            variants={itemVariants}
          >
            <h4 className="font-bold text-[var(--app-ink)] text-sm truncate">{finalTitle}</h4>
            <div className="flex justify-between text-xs text-[var(--app-text)] transition-all">
              <span>订单类型</span>
              <span className="text-[var(--app-ink)] font-medium">
                {activity ? '单项预订' : '打包预订'}
              </span>
            </div>
            {finalServiceCount > 1 && (
              <div className="flex justify-between text-xs text-[var(--app-text)] transition-all">
                <span>服务数量</span>
                <span className="text-[var(--app-ink)] font-medium">{finalServiceCount} 项</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-[var(--app-text)] transition-all">
              <span>预订状态</span>
              <span className="text-[var(--peach-ink)] font-bold">待支付</span>
            </div>
          </motion.div>
        </motion.div>

        <motion.div className="app-card px-5 py-4 rounded-[24px]" variants={itemVariants}>
          <motion.div
            onClick={() => setSelectedMethod('meituan')}
            className="flex items-center justify-between py-4 border-b border-[var(--app-border)] cursor-pointer transition-all"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center">
              <div className="w-6 h-6 bg-[var(--brand)] rounded-full flex items-center justify-center mr-3 font-bold text-[var(--brand-ink)] text-xs transition-all">
                美
              </div>
              <span className="font-bold text-[var(--app-ink)] text-[15px]">美团支付</span>
              <span className="bg-[var(--brand-soft)] text-[var(--brand-ink)] text-[10px] px-1.5 py-0.5 rounded ml-2 font-bold transition-all">
                推荐
              </span>
            </div>
            <motion.div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                selectedMethod === 'meituan'
                  ? 'border-[var(--brand)] bg-[var(--brand)]'
                  : 'border-gray-300'
              }`}
              animate={selectedMethod === 'meituan' ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {selectedMethod === 'meituan' ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </motion.div>
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--app-text-soft)]" />
              )}
            </motion.div>
          </motion.div>

          <motion.div
            onClick={() => setSelectedMethod('wechat')}
            className="flex items-center justify-between py-4 border-b border-[var(--app-border)] cursor-pointer transition-all"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center">
              <div className="w-6 h-6 bg-[rgba(42,162,122,0.16)] rounded-full flex items-center justify-center mr-3 font-bold text-[var(--mint-ink)] text-xs transition-all">
                微
              </div>
              <span className="text-[var(--app-ink)] text-[15px] font-medium">微信支付</span>
            </div>
            <motion.div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                selectedMethod === 'wechat'
                  ? 'border-[var(--brand)] bg-[var(--brand)]'
                  : 'border-gray-300'
              }`}
              animate={selectedMethod === 'wechat' ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {selectedMethod === 'wechat' ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </motion.div>
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--app-text-soft)]" />
              )}
            </motion.div>
          </motion.div>

          <motion.div
            onClick={() => setSelectedMethod('alipay')}
            className="flex items-center justify-between py-4 cursor-pointer transition-all"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center">
              <div className="w-6 h-6 bg-[rgba(107,125,152,0.16)] rounded-full flex items-center justify-center mr-3 font-bold text-[var(--sky-ink)] text-xs transition-all">
                支
              </div>
              <span className="text-[var(--app-ink)] text-[15px] font-medium">支付宝支付</span>
            </div>
            <motion.div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                selectedMethod === 'alipay'
                  ? 'border-[var(--brand)] bg-[var(--brand)]'
                  : 'border-gray-300'
              }`}
              animate={selectedMethod === 'alipay' ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {selectedMethod === 'alipay' ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </motion.div>
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--app-text-soft)]" />
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/82 backdrop-blur-xl border-t border-[var(--app-border)] flex pb-safe z-30 justify-center shadow-[0_-8px_30px_rgba(20,24,33,0.05)]">
        <AnimatePresence mode="wait">
          {payError && (
            <motion.div
              key="error"
              className="absolute -top-8 left-0 right-0 text-[var(--danger-ink)] text-sm text-center cursor-pointer"
              variants={errorVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {payError}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          onClick={handlePay}
          disabled={isPaying}
          className="app-btn-primary w-full font-bold py-3.5 rounded-full transition-colors text-lg disabled:opacity-50 cursor-pointer relative overflow-hidden"
          whileHover={{ scale: isPaying ? 1 : 1.02, y: isPaying ? 0 : -2 }}
          whileTap={{ scale: isPaying ? 1 : 0.98 }}
          transition={{ duration: 0.3 }}
        >
          {isPaying ? (
            <motion.div
              className="flex items-center justify-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                <Loader2 className="w-5 h-5" />
              </motion.div>
              <span>支付处理中...</span>
            </motion.div>
          ) : (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              立即支付 ¥{amountText}
            </motion.span>
          )}
        </motion.button>
      </div>
    </div>
  );
}
