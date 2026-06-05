import React, { useState, memo } from 'react';
import { motion } from 'motion/react';
import { Truck, Star, Zap, Heart, ChevronRight } from 'lucide-react';
import GradientImg from '../ui/GradientImg';
import { copyText } from '../../services/clientActions';

export interface DeliveryCardData {
  id: string;
  name: string;
  category: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: number;
  avgPrice: number;
  tags: string[];
  image?: string;
  poiId?: string;
  address?: string;
  businessArea?: string;
  phone?: string;
}

const gradients = [
  'from-slate-100 to-slate-200',
  'from-[#eef2f9] to-[#e7edf7]',
  'from-slate-100 to-[#edf1f8]',
  'from-[#f5f7fb] to-[#e9eef7]',
  'from-[#edf2fb] to-[#e3eaf6]',
  'from-slate-100 to-[#eceff5]',
];

function truncateText(text: string, max = 16) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface DeliveryCardItemProps {
  item: DeliveryCardData;
  index: number;
  onSelect?: (item: DeliveryCardData) => void;
}

function DeliveryCardItem({ item, index, onSelect }: DeliveryCardItemProps) {
  const [fav, setFav] = useState(false);
  const tagLabel = truncateText(item.tags[0] || item.category, 10);
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3, ease: 'easeOut' }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect?.(item)}
      className="app-card cursor-pointer overflow-hidden rounded-2xl"
    >
      <div
        className={`h-[82px] bg-gradient-to-br ${gradients[(index + 2) % gradients.length]} relative overflow-hidden`}
      >
        <GradientImg
          src={item.image}
          alt={item.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute bottom-2 left-3">
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[var(--app-ink)] backdrop-blur-sm">
            {item.category}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setFav(!fav);
          }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center cursor-pointer"
        >
          <Heart
            className={`w-3.5 h-3.5 transition-colors ${fav ? 'text-[var(--rose-ink)] fill-[var(--rose-ink)]' : 'text-gray-400'}`}
          />
        </button>
      </div>
      <div className="p-3">
        <h4 className="mb-1 line-clamp-1 text-[13px] font-bold text-[var(--app-ink)]">
          {item.name}
        </h4>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Star className="w-3 h-3 text-[var(--app-text-soft)] fill-[var(--app-text-soft)]" />
          <span className="text-[11px] font-semibold text-[var(--app-text)]">{item.rating}</span>
          <span className="text-[10px] text-gray-300">|</span>
          <span className="text-[11px] font-semibold text-[var(--app-ink)]">¥{item.avgPrice}</span>
        </div>
        <div className="flex items-center gap-1.5 mb-2.5">
          <div className="flex items-center gap-1 rounded-[6px] bg-[var(--rose-soft)] px-1.5 py-0.5">
            <Zap className="w-3 h-3 text-[var(--rose-ink)]" />
            <span className="text-[10px] font-semibold text-[var(--rose-ink)]">
              {item.deliveryTime}
            </span>
          </div>
          <span className="text-[10px] text-[var(--app-text-soft)]">配送¥{item.deliveryFee}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--app-text-soft)]">
          <span className="line-clamp-1 min-w-0">{tagLabel}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyText(
                `${item.name}，${item.deliveryTime}送达，配送费¥${item.deliveryFee}，人均¥${item.avgPrice}`
              );
            }}
            className="shrink-0 flex items-center gap-1 text-[var(--rose-ink)] active:scale-[0.97] transition-transform cursor-pointer"
          >
            去下单 <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export const DeliveryCarousel = memo(function DeliveryCarousel({
  data,
  onItemAction,
  onViewMore,
}: {
  data: DeliveryCardData[];
  onItemAction?: (item: DeliveryCardData) => void;
  onViewMore?: (items: DeliveryCardData[]) => void;
}) {
  const featured = data.slice(0, 2);
  const secondary = data.slice(2, 5);
  return (
    <div className="app-card w-full overflow-hidden rounded-[24px]">
      <div className="border-b border-[var(--rose-strong)] bg-[linear-gradient(135deg,rgba(255,247,251,0.95)_0%,rgba(255,231,241,0.82)_100%)] px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/88">
            <Truck className="w-4 h-4 text-[var(--rose-ink)]" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-[var(--app-ink)]">现在点这些更快送到</div>
            <div className="mt-0.5 text-[11px] font-medium text-[var(--app-text)]">
              优先看高分、近距离、配送快的
            </div>
          </div>
          <div className="app-chip-soft ml-auto rounded-full px-3 py-1.5 text-[11px] font-semibold text-[var(--rose-ink)] shadow-sm">
            {data.length} 家
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['30 分钟内', '高分优先', '适合马上下单'].map((tag) => (
            <span
              key={tag}
              className="app-chip-soft rounded-full px-2.5 py-1 text-[10px] font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {featured.map((item, i) => (
            <DeliveryCardItem key={item.id} item={item} index={i} onSelect={onItemAction} />
          ))}
        </div>

        {secondary.length > 0 && (
          <div className="app-card-soft space-y-2.5 rounded-2xl p-2.5">
            {secondary.map((item, i) => (
              <div
                key={item.id}
                className="app-card flex w-full items-center gap-3 rounded-[16px] px-3 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
              >
                <div
                  className={`w-[54px] h-[54px] rounded-[14px] overflow-hidden shrink-0 bg-gradient-to-br ${gradients[(i + 1) % gradients.length]} relative`}
                >
                  <GradientImg
                    src={item.image}
                    alt={item.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-[13px] font-bold text-[var(--app-ink)]">
                    {truncateText(item.name, 18)}
                  </div>
                  <div className="mt-1 flex items-center gap-1 overflow-hidden whitespace-nowrap text-[11px] font-medium text-[var(--app-text-soft)]">
                    <span className="shrink-0 text-[var(--app-text)]">{item.deliveryTime}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0">配送¥{item.deliveryFee}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0">¥{item.avgPrice}</span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    onItemAction
                      ? onItemAction(item)
                      : copyText(
                          `${item.name}，${item.deliveryTime}送达，配送费¥${item.deliveryFee}，人均¥${item.avgPrice}`
                        )
                  }
                  className="shrink-0 min-w-[52px] rounded-full bg-[var(--rose-soft)] px-3 py-1.5 text-[11px] font-semibold text-[var(--rose-ink)] active:scale-[0.97] transition-transform"
                >
                  下单
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => onViewMore?.(data)}
          className="h-11 w-full rounded-[16px] border border-[var(--rose-strong)] bg-[var(--rose-soft)] text-[13px] font-semibold text-[var(--rose-ink)] active:scale-[0.98] transition-transform cursor-pointer"
        >
          查看更多外卖
        </button>
      </div>
    </div>
  );
});
