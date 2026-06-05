import { Star, Navigation, ShoppingBag, Tag, type LucideIcon } from 'lucide-react';
import GradientImg from '../ui/GradientImg';

export interface ResultCardData {
  id: string;
  name: string;
  image?: string;
  rating?: number;
  avgPrice?: number;
  distance?: string;
  address?: string;
  category?: string;
  tags?: string[];
  deliveryFee?: number;
  deliveryTime?: string;
  venue?: string;
  price?: number;
  date?: string;
  time?: string;
  discount?: string;
  condition?: string;
}

interface ResultCardProps {
  type: 'restaurant' | 'delivery' | 'ticket' | 'coupon';
  data: ResultCardData;
  onSelect?: (data: ResultCardData) => void;
  onNavigate?: (data: ResultCardData) => void;
  onQuickOrder?: (data: ResultCardData) => void;
}

const CARD_STYLES: Record<
  string,
  { border: string; shadow: string; accent: string; soft: string; icon: LucideIcon }
> = {
  restaurant: {
    border: 'border-[var(--peach-strong)]',
    shadow: 'shadow-[0_8px_24px_rgba(233,114,91,0.06)]',
    accent: 'text-[var(--peach-ink)]',
    soft: 'bg-[var(--peach-soft)]',
    icon: Star,
  },
  delivery: {
    border: 'border-[var(--rose-strong)]',
    shadow: 'shadow-[0_8px_24px_rgba(201,75,134,0.06)]',
    accent: 'text-[var(--rose-ink)]',
    soft: 'bg-[var(--rose-soft)]',
    icon: ShoppingBag,
  },
  ticket: {
    border: 'border-[var(--mint-strong)]',
    shadow: 'shadow-[0_8px_24px_rgba(42,162,122,0.06)]',
    accent: 'text-[var(--mint-ink)]',
    soft: 'bg-[var(--mint-soft)]',
    icon: Star,
  },
  coupon: {
    border: 'border-[#ffe2a3]',
    shadow: 'shadow-[0_8px_24px_rgba(255,200,58,0.1)]',
    accent: 'text-[var(--brand-ink)]',
    soft: 'bg-[var(--brand-soft)]',
    icon: Tag,
  },
};

export function ResultCard({ type, data, onSelect, onNavigate, onQuickOrder }: ResultCardProps) {
  const styles = CARD_STYLES[type];
  const AccentIcon = styles.icon;

  if (type === 'coupon') {
    return (
      <button
        onClick={() => onSelect?.(data)}
        className="w-full rounded-[24px] bg-white p-3.5 border border-[#ffe2a3] shadow-[0_8px_24px_rgba(255,200,58,0.1)] text-left overflow-hidden relative active:scale-[0.99] transition-transform"
      >
        <div className="absolute top-3 right-3 rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--brand-ink)]">
          神券可领
        </div>
        <div className="flex gap-3 items-center">
          <div className="w-[88px] h-[88px] rounded-2xl overflow-hidden shrink-0 bg-[linear-gradient(135deg,rgba(255,249,235,0.98)_0%,rgba(255,244,191,0.9)_100%)] flex flex-col items-center justify-center text-[var(--brand-ink)]">
            <div className="text-[22px] font-bold leading-none">{data.discount}</div>
            <div className="mt-1 text-[10px] font-bold text-[rgba(59,43,0,0.72)] text-center px-2">
              {data.condition}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-gray-900 line-clamp-1">{data.name}</h3>
            <div className="mt-2 text-[13px] font-bold text-gray-500 line-clamp-1">{data.date}</div>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--brand-ink)]">
                可叠加
              </span>
              <span className="rounded-full bg-[#FFF7F0] px-2.5 py-1 text-[10px] font-bold text-[#c57d00]">
                到店/外卖通用
              </span>
            </div>
          </div>
          <span className="shrink-0 text-[13px] font-bold text-[var(--brand-ink)]">去领</span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => onSelect?.(data)}
      className={`w-full rounded-[24px] bg-white p-3.5 border ${styles.border} ${styles.shadow} text-left active:scale-[0.99] transition-transform`}
    >
      <div className="flex gap-3">
        {/* 左侧商家图片 */}
        <div className="w-[88px] h-[88px] rounded-2xl overflow-hidden shrink-0 bg-gray-100 flex-shrink-0">
          <GradientImg src={data.image} alt={data.name} className="w-full h-full object-cover" />
        </div>

        {/* 右侧信息区 */}
        <div className="min-w-0 flex-1 flex flex-col">
          <h3 className="text-[15px] font-bold text-gray-900 line-clamp-1">{data.name}</h3>
          <div className="mt-1.5 flex items-center gap-2 text-[13px] flex-wrap">
            <div className={`flex items-center gap-1 ${styles.accent} font-bold shrink-0`}>
              <AccentIcon className={`w-3.5 h-3.5 ${styles.accent}`} />
              <span>{data.rating && data.rating > 0 ? data.rating.toFixed(1) : '暂无评分'}</span>
            </div>
            {data.category && (
              <span className="text-gray-400 font-bold truncate">{data.category}</span>
            )}
            {data.deliveryTime && (
              <span className={`${styles.accent} font-bold shrink-0`}>{data.deliveryTime}</span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[13px] font-bold text-gray-500 flex-wrap">
            {data.avgPrice && data.avgPrice > 0 && (
              <span className="shrink-0">¥{data.avgPrice}/人</span>
            )}
            {type === 'delivery' && data.deliveryFee !== undefined && (
              <span className={`shrink-0 ${styles.accent}`}>配送¥{data.deliveryFee}</span>
            )}
            {data.venue && <span className="truncate">{data.venue}</span>}
            {data.date && <span className="shrink-0">{data.date}</span>}
            {data.time && <span className="shrink-0">{data.time}</span>}
            {data.distance && (
              <span className={`${styles.accent} font-bold shrink-0`}>直线{data.distance}</span>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {data.tags?.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className={`rounded-[8px] ${styles.soft} px-2 py-0.5 text-[10px] font-bold ${styles.accent}`}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onQuickOrder && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickOrder(data);
                  }}
                  className="text-[11px] font-bold text-[var(--brand-ink)] bg-[var(--brand-soft)] rounded-full px-2.5 py-1 active:scale-95 transition-transform"
                >
                  快速下单
                </span>
              )}
              {onNavigate && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(data);
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-gray-400"
                >
                  <Navigation className="w-3 h-3" />
                  导航
                </span>
              )}
            </div>
          </div>
          {data.address && (
            <div className="mt-2 text-[13px] font-medium text-gray-400 truncate">
              {data.address}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export function ResultCardSkeleton() {
  return (
    <div className="w-full rounded-[24px] bg-white p-3.5 border border-gray-100 animate-pulse">
      <div className="flex gap-3">
        {/* 左侧图片骨架 */}
        <div className="w-[88px] h-[88px] rounded-2xl bg-gray-100 shrink-0" />
        {/* 右侧信息骨架 */}
        <div className="flex-1 min-w-0">
          <div className="h-5 bg-gray-100 rounded-lg w-3/4 mb-2" />
          <div className="flex items-center gap-3 mb-2">
            <div className="h-4 bg-gray-100 rounded-lg w-16" />
            <div className="h-4 bg-gray-100 rounded-lg w-12" />
            <div className="h-4 bg-gray-100 rounded-lg w-20" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 bg-gray-100 rounded-lg w-24" />
            <div className="h-4 bg-gray-100 rounded-lg w-16" />
          </div>
          <div className="flex gap-2 mb-2">
            <div className="h-6 bg-gray-100 rounded-lg w-14" />
            <div className="h-6 bg-gray-100 rounded-lg w-14" />
          </div>
          <div className="h-4 bg-gray-100 rounded-lg w-2/3" />
        </div>
      </div>
    </div>
  );
}
