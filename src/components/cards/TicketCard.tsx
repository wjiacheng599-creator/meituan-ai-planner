import React, { memo } from 'react';
import { motion } from 'motion/react';
import { Ticket, Star, MapPin, Clock } from 'lucide-react';
import GradientImg from '../ui/GradientImg';
import { copyText } from '../../services/clientActions';

export interface TicketCardData {
  id: string;
  name: string;
  venue: string;
  date: string;
  time: string;
  price: number;
  rating: number;
  tags: string[];
  image?: string;
  poiId?: string;
  openTime?: string;
  address?: string;
  type?: string;
}

const gradients = [
  'from-slate-100 to-slate-200',
  'from-[#eef2f9] to-[#e7edf7]',
  'from-slate-100 to-[#edf1f8]',
  'from-[#f5f7fb] to-[#e9eef7]',
  'from-[#edf2fb] to-[#e3eaf6]',
  'from-slate-100 to-[#eceff5]',
];

function formatShortDateLabel(date: string) {
  return date
    .replace(/本周末/g, '周末')
    .replace(/本周/g, '本周')
    .replace(/周六日/g, '周末')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatShortTimeLabel(time: string) {
  return time
    .replace(/：/g, ':')
    .replace(/(\d{2}:\d{2})-(\d{2}:\d{2})/, '$1-$2')
    .replace(/\s+/g, '')
    .trim();
}

function truncateText(text: string, max = 16) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface TicketCardItemProps {
  item: TicketCardData;
  index: number;
  onSelect?: (item: TicketCardData) => void;
}

function TicketCardItem({ item, index, onSelect }: TicketCardItemProps) {
  const dateLabel = formatShortDateLabel(item.date);
  const timeLabel = formatShortTimeLabel(item.time);
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
        className={`h-[88px] bg-gradient-to-br ${gradients[(index + 4) % gradients.length]} relative overflow-hidden`}
      >
        <GradientImg
          src={item.image}
          alt={item.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-2.5 left-3 right-3">
          <h4 className="min-h-[32px] line-clamp-2 text-[13px] font-bold leading-snug text-white drop-shadow-sm">
            {truncateText(item.name, 14)}
          </h4>
        </div>
        <div className="absolute top-2 right-2">
          <div className="bg-white/90 backdrop-blur-sm rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5 text-[var(--app-text-soft)] fill-[var(--app-text-soft)]" />
            <span className="text-[10px] font-semibold text-[var(--app-ink)]">{item.rating}</span>
          </div>
        </div>
        {item.tags[0] && (
          <div className="absolute top-2 left-2">
            <span className="rounded-full bg-[var(--mint-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--mint-ink)]">
              {item.tags[0]}
            </span>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div className="flex items-start gap-1 mb-1">
          <MapPin className="mt-[2px] h-3 w-3 shrink-0 text-gray-400" />
          <span className="text-[11px] text-gray-500 font-bold line-clamp-1">
            {truncateText(item.venue, 12)}
          </span>
        </div>
        <div className="flex items-start gap-1">
          <Clock className="mt-[2px] h-3 w-3 shrink-0 text-gray-400" />
          <span className="text-[11px] text-gray-500 font-bold line-clamp-2 leading-snug min-h-[30px]">
            {dateLabel} {timeLabel}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2">
          <div className="min-w-0 flex items-baseline gap-0.5">
            <span className="text-[13px] font-bold leading-none text-[var(--app-ink)]">
              {item.price > 0 ? `¥${item.price}` : '免费'}
            </span>
            {item.price > 0 && <span className="text-[10px] leading-none text-gray-400">起</span>}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyText(`${item.name}，${item.venue}，${item.date} ${item.time}，¥${item.price}起`);
            }}
            className="ml-auto inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-[var(--mint-strong)] bg-[var(--mint-soft)] px-3 text-[10px] font-semibold leading-none text-[var(--mint-ink)] shadow-[0_2px_8px_rgba(42,162,122,0.12)] transition-transform active:scale-[0.97] cursor-pointer"
          >
            购票
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export const TicketCarousel = memo(function TicketCarousel({
  data,
  onItemAction,
  onViewMore,
}: {
  data: TicketCardData[];
  onItemAction?: (item: TicketCardData) => void;
  onViewMore?: (items: TicketCardData[]) => void;
}) {
  const featured = data.slice(0, 2);
  const secondary = data.slice(2, 5);
  return (
    <div className="app-card w-full overflow-hidden rounded-[24px]">
      <div className="border-b border-[var(--mint-strong)] bg-[linear-gradient(135deg,rgba(245,255,250,0.95)_0%,rgba(238,248,241,0.82)_100%)] px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/88">
            <Ticket className="w-4 h-4 text-[var(--mint-ink)]" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-[var(--app-ink)]">
              这几场活动最近很值得去
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-[var(--app-text)]">
              先看热门档期，再决定要不要出门
            </div>
          </div>
          <div className="app-chip-soft ml-auto inline-flex h-8 min-w-[54px] shrink-0 items-center justify-center rounded-full px-3 text-[11px] font-semibold whitespace-nowrap text-[var(--mint-ink)] shadow-sm">
            {data.length} 场
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['本周可去', '热门优先', '价格一眼看清'].map((tag) => (
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
        <div className="grid grid-cols-2 gap-2.5">
          {featured.map((item, i) => (
            <TicketCardItem key={item.id} item={item} index={i} onSelect={onItemAction} />
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
                  className={`w-[54px] h-[54px] rounded-[14px] overflow-hidden shrink-0 bg-gradient-to-br ${gradients[(i + 3) % gradients.length]} relative`}
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
                    <span className="shrink-0">{formatShortDateLabel(item.date)}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0">{formatShortTimeLabel(item.time)}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0 text-[var(--app-ink)]">
                      {item.price > 0 ? `¥${item.price}起` : '免费'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    onItemAction
                      ? onItemAction(item)
                      : copyText(
                          `${item.name}，${item.venue}，${item.date} ${item.time}，¥${item.price}起`
                        )
                  }
                  className="shrink-0 min-w-[52px] rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-[11px] font-semibold text-[var(--mint-ink)] active:scale-[0.97] transition-transform"
                >
                  去看
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => onViewMore?.(data)}
          className="h-11 w-full rounded-[16px] border border-[var(--mint-strong)] bg-[var(--mint-soft)] text-[13px] font-semibold text-[var(--mint-ink)] active:scale-[0.98] transition-transform cursor-pointer"
        >
          查看更多活动
        </button>
      </div>
    </div>
  );
});
