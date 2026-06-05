import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import type { ResultCardData } from '../cards/ResultCard';

interface QuickOrderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  data: ResultCardData | null;
  type: 'restaurant' | 'delivery';
  onConfirm: (data: ResultCardData, quantity: number) => void;
}

export function QuickOrderSheet({ isOpen, onClose, data, type, onConfirm }: QuickOrderSheetProps) {
  const [selectedOption, setSelectedOption] = useState('standard');

  const price = data?.avgPrice || 100;
  const standardPrice = price;
  const doublePrice = Math.max(price * 2 - 20, price + 10);
  const totalPrice = selectedOption === 'standard' ? standardPrice : doublePrice;

  const handleConfirm = () => {
    if (!data) return;
    onConfirm(data, selectedOption === 'standard' ? 1 : 2);
  };

  return (
    <AnimatePresence>
      {isOpen && data && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            key={`backdrop-${data.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            key={data.id}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[430px] bg-white rounded-t-[28px] shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[var(--brand-ink)]" />
                <h2 className="text-[18px] font-bold text-gray-900">快速下单</h2>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-5 pb-5">
              <div className="rounded-[16px] bg-[var(--brand-soft)] p-4 mb-4">
                <h3 className="text-[15px] font-bold text-gray-900 line-clamp-1">{data.name}</h3>
                <div className="mt-1 text-[13px] font-bold text-gray-500">
                  {type === 'restaurant' ? '到店就餐' : '外卖配送'}
                  {data.distance && ` · ${data.distance}`}
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <button
                  onClick={() => setSelectedOption('standard')}
                  className={`w-full flex items-center justify-between rounded-[16px] border-2 p-4 text-left transition-all ${
                    selectedOption === 'standard'
                      ? 'border-[var(--brand-ink)] bg-[var(--brand-soft)]'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div>
                    <div className="text-[15px] font-bold text-gray-900">单人套餐</div>
                    <div className="mt-0.5 text-[13px] text-gray-400 font-bold">1人份</div>
                  </div>
                  <span className="text-[15px] font-bold text-[var(--brand-ink)]">
                    ¥{standardPrice}
                  </span>
                </button>

                <button
                  onClick={() => setSelectedOption('double')}
                  className={`w-full flex items-center justify-between rounded-[16px] border-2 p-4 text-left transition-all ${
                    selectedOption === 'double'
                      ? 'border-[var(--brand-ink)] bg-[var(--brand-soft)]'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div>
                    <div className="text-[15px] font-bold text-gray-900">双人套餐</div>
                    <div className="mt-0.5 text-[13px] text-gray-400 font-bold">2人份 · 省¥20</div>
                  </div>
                  <span className="text-[15px] font-bold text-[var(--brand-ink)]">
                    ¥{doublePrice}
                  </span>
                </button>
              </div>

              <button
                onClick={handleConfirm}
                className="w-full h-14 rounded-full bg-[var(--brand)] text-[var(--brand-ink)] text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_8px_24px_rgba(255,200,58,0.3)]"
              >
                <ShoppingBag className="w-5 h-5" />
                确认下单 · ¥{totalPrice}
              </button>
            </div>

            <div className="h-8 flex items-center justify-center pb-1">
              <div className="w-8 h-1 rounded-full bg-gray-300" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
