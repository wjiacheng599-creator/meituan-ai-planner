import React, { memo } from 'react';
import { motion } from 'motion/react';
import { Utensils, Star, ChevronRight } from 'lucide-react';
import { seededRating } from '../../services/utils';
import GradientImg from '../ui/GradientImg';

export interface RestaurantCardData {
  id: string;
  name: string;
  rating: number;
  avgPrice: number;
  distance: string;
  category: string;
  tags: string[];
  address: string;
  image?: string;
  poiId?: string;
  openTime?: string;
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

interface RestaurantCardItemProps {
  item: RestaurantCardData;
  index: number;
  onNavigate?: (item: RestaurantCardData) => void;
}

function RestaurantCardItem({ item, index, onNavigate }: RestaurantCardItemProps) {
  const rating = item.rating || parseFloat(seededRating(item.id));
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3, ease: 'easeOut' }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onNavigate?.(item)}
      className="app-card cursor-pointer overflow-hidden rounded-2xl"
    >
      <div
        className={`h-[82px] bg-gradient-to-br ${gradients[index % gradients.length]} relative overflow-hidden`}
      >
        <GradientImg
          src={item.image}
          alt={item.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[var(--app-ink)] backdrop-blur-sm">
            {item.category}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <div className="bg-white/90 backdrop-blur-sm rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5 text-[var(--app-text-soft)] fill-[var(--app-text-soft)]" />
            <span className="text-[10px] font-semibold text-[var(--app-ink)]">{rating}</span>
          </div>
        </div>
      </div>
      <div className="p-3">
        <h4 className="mb-1.5 line-clamp-1 text-[13px] font-bold text-[var(--app-ink)]">
          {item.name}
        </h4>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[13px] font-bold text-[var(--app-ink)]">¥{item.avgPrice}/人</span>
          <span className="text-[10px] text-gray-300">|</span>
          <span className="text-[11px] font-medium text-[var(--app-text-soft)]">
            {item.distance}
          </span>
        </div>
        <div className="flex gap-1 flex-wrap mb-2.5">
          {item.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-[6px] bg-[var(--app-card-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--app-text)]"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] font-medium text-[var(--app-text-soft)]">
          <span className="line-clamp-1">{item.address}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate?.(item);
            }}
            className="ml-2 shrink-0 flex items-center gap-1 text-[var(--app-text)] active:scale-[0.97] transition-transform cursor-pointer"
          >
            去看看 <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export const RestaurantCarousel = memo(function RestaurantCarousel({
  data,
  onItemAction,
  onViewMore,
}: {
  data: RestaurantCardData[];
  onItemAction?: (item: RestaurantCardData) => void;
  onViewMore?: (items: RestaurantCardData[]) => void;
}) {
  const featured = data.slice(0, 2);
  const secondary = data.slice(2, 5);
  return (
    <div className="app-card w-full overflow-hidden rounded-[24px]">
      <div className="border-b border-[var(--peach-strong)] bg-[linear-gradient(135deg,rgba(255,247,251,0.94)_0%,rgba(255,241,225,0.66)_100%)] px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/88">
            <Utensils className="w-4 h-4 text-[var(--peach-ink)]" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-[var(--app-ink)]">
              为你找到一批适合的餐厅
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-[var(--app-text)]">
              先看精选，再进去挑更多
            </div>
          </div>
          <button
            onClick={() => onViewMore?.(data)}
            className="app-btn-ghost ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold active:scale-[0.97] transition-transform cursor-pointer"
          >
            更多
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['附近优先', '评分靠前', `${data.length} 家可选`].map((tag) => (
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
            <RestaurantCardItem key={item.id} item={item} index={i} onNavigate={onItemAction} />
          ))}
        </div>

        {secondary.length > 0 && (
          <div className="app-card-soft space-y-2.5 rounded-2xl p-2.5">
            {secondary.map((item, i) => (
              <button
                key={item.id}
                onClick={() => onItemAction?.(item)}
                className="app-card flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left active:scale-[0.98] transition-transform cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
              >
                <div
                  className={`w-[54px] h-[54px] rounded-[14px] overflow-hidden shrink-0 bg-gradient-to-br ${gradients[(i + 2) % gradients.length]} relative`}
                >
                  <GradientImg
                    src={item.image}
                    alt={item.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-[13px] font-bold text-[var(--app-ink)]">
                    {item.name}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--app-text-soft)]">
                    <span className="text-[var(--app-text)]">{item.rating}</span>
                    <span>·</span>
                    <span>{item.category}</span>
                    <span>·</span>
                    <span>{item.distance}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => onViewMore?.(data)}
          className="app-btn-dark h-11 w-full rounded-[16px] text-[13px] font-semibold active:scale-[0.98] transition-transform cursor-pointer"
        >
          查看更多餐厅
        </button>
      </div>
    </div>
  );
});
