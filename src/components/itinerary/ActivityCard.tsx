import React, { memo, useCallback } from 'react';
import { motion } from 'motion/react';
import { seededRating } from '../../services/utils';
import {
  Utensils,
  Car,
  Target,
  Star as StarIcon,
  Navigation,
  MapPin,
  Check,
  Heart,
  Shield,
  AlertCircle,
  Info,
  Calendar,
} from 'lucide-react';
import type { ActivityCardProps } from './types';

const typeColors: Record<string, { bg: string; text: string; label: string }> = {
  food: { bg: 'bg-[var(--peach-soft)]', text: 'text-[var(--peach-ink)]', label: '美食' },
  travel: { bg: 'bg-[var(--sky-soft)]', text: 'text-[var(--sky-ink)]', label: '交通' },
  activity: { bg: 'bg-[var(--rose-soft)]', text: 'text-[var(--rose-ink)]', label: '活动' },
};

const safetyKeywords = ['安全', '保险', '急救', '医疗', '防护', '儿童', '亲子', '无障碍'];

interface ActivityCardComponentProps extends ActivityCardProps {
  onActivityClick: (activity: any) => void;
  onToggleSelect?: (id: string) => void;
}

const ActivityCardComponent = memo(
  function ActivityCardComponent({
    activity,
    index,
    variant = 'default',
    isSelected,
    isBooked,
    isEmphasized: _isEmphasized,
    travelTime,
    onActivityClick,
    onToggleSelect,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    draggable,
  }: ActivityCardProps) {
    const rating = seededRating(activity.id || 'unknown');
    const typeConfig = typeColors[activity.type] || typeColors.activity;

    const isRomantic = variant === 'romantic';
    const isFamily = variant === 'family';
    const isBusiness = variant === 'business';
    const isCompact = variant === 'compact';

    const safetyTags = (activity.tags || []).filter((tag) =>
      safetyKeywords.some((k) => tag.includes(k))
    );

    const cardBorderClass = isBooked
      ? 'border-[var(--mint-strong)]'
      : isSelected
        ? 'border-[var(--peach-strong)]'
        : isRomantic
          ? 'border-rose-200'
          : isFamily
            ? 'border-amber-200'
            : isBusiness
              ? 'border-slate-200'
              : 'border-[var(--app-border)]';

    const imageWidthClass = isBusiness ? 'w-20' : 'w-24';

    const titleColorClass = isRomantic
      ? 'text-rose-500 group-hover:text-rose-600'
      : isFamily
        ? 'text-amber-700 group-hover:text-amber-800'
        : 'text-[var(--app-ink)] group-hover:text-[var(--app-ink)]';

    const maxTags = isFamily ? 3 : 2;

    const contentPaddingClass = isBusiness ? 'px-2.5 pb-2.5 pt-2' : 'px-3 pb-3 pt-2.5';

    const navButtonClass = 'bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-600';

    const actionButtonClass = isBooked
      ? 'bg-[var(--app-ink)] hover:bg-gray-800 active:bg-gray-700 text-white'
      : isSelected
        ? isRomantic
          ? 'bg-rose-100 hover:opacity-90 active:opacity-90 text-rose-600'
          : isFamily
            ? 'bg-amber-100 hover:opacity-90 active:opacity-90 text-amber-700'
            : isBusiness
              ? 'bg-slate-100 hover:opacity-90 active:opacity-90 text-slate-700'
              : 'bg-[var(--peach-soft)] hover:opacity-90 active:opacity-90 text-[var(--peach-ink)]'
        : isRomantic
          ? 'bg-rose-400 hover:bg-rose-500 active:bg-rose-600 text-white'
          : isFamily
            ? 'bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-white'
            : isBusiness
              ? 'bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white'
              : 'bg-[var(--app-ink)] hover:bg-gray-800 active:bg-gray-700 text-white';

    const selectButtonClass = isBooked
      ? 'bg-[var(--mint-ink)] shadow-sm'
      : isSelected
        ? 'bg-[var(--peach-ink)] shadow-sm'
        : isRomantic
          ? 'bg-rose-50 hover:bg-rose-100'
          : isFamily
            ? 'bg-amber-50 hover:bg-amber-100'
            : isBusiness
              ? 'bg-slate-100 hover:bg-slate-200'
              : isCompact
                ? 'bg-white hover:bg-gray-50 px-3 py-2'
                : 'bg-gray-50 hover:bg-gray-100';

    // compact 模式：单行精简卡片
    if (isCompact) {
      return (
        <div className="relative z-10 transition-all duration-200">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <span className="text-[11px] font-semibold text-gray-500 min-w-[60px]">
              {activity.timeLine}
            </span>
            <span className="text-[12px] font-bold text-gray-800 truncate">{activity.title}</span>
            <span className="text-[10px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded ml-auto">
              {typeColors[activity.type]?.label || activity.type}
            </span>
          </motion.div>
        </div>
      );
    }

    const timeBadgeClass = isBusiness
      ? 'text-[10px] font-bold text-[var(--app-ink)] bg-gray-50 px-2 py-0.5 rounded-md'
      : isFamily
        ? 'text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md'
        : 'text-[10px] font-bold text-[var(--app-ink)] bg-gray-50 px-2 py-0.5 rounded-md';

    const ratingBadgeClass = 'bg-gray-50';
    const ratingTextClass = 'text-[var(--app-ink)]';

    const tagClass = isBusiness
      ? 'text-[9px] text-slate-500 font-medium bg-slate-50 px-2 py-0.5 rounded-md'
      : isFamily
        ? 'text-[9px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md'
        : 'text-[9px] text-[var(--app-text-soft)] font-medium bg-gray-50 px-2 py-0.5 rounded-md';

    return (
      <div
        className="relative z-10 transition-all duration-200"
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.3, ease: 'easeOut' }}
          className="flex group items-start"
        >
          <div className="w-10 flex justify-center shrink-0 z-10 pt-2.5">
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-[var(--app-bg)] transition-colors ${isBooked ? 'bg-[var(--mint-ink)]' : isSelected ? 'bg-[var(--peach-ink)]' : 'bg-[var(--app-ink)]'}`}
            >
              <span className="text-white text-[10px] font-black">{index + 1}</span>
            </div>
          </div>

          <div
            className={`flex-1 overflow-hidden rounded-xl border shadow-[var(--shadow-card)] transition-all duration-200 group-hover:shadow-[var(--shadow-soft)] ${cardBorderClass} bg-[var(--app-card)]`}
          >
            <div className="flex overflow-hidden">
              <div
                className={`relative ${imageWidthClass} max-h-32 shrink-0 overflow-hidden bg-gray-100 border-r border-[var(--app-border)]`}
              >
                {activity.imageUrl ? (
                  <img
                    src={activity.imageUrl}
                    alt={activity.title}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.className =
                          'flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300';
                        fallback.innerHTML =
                          activity.type === 'food'
                            ? '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#6b7280" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 1 1-7.06.06M12 12a3 3 0 1 0 0-3 3 3 0 0 0 0 3Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 12v6" /></svg>'
                            : activity.type === 'travel'
                              ? '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#6b7280" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12h.01M12 6h.01M18 12h.01M12 18h.01" /></svg>'
                              : '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#6b7280" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18M3 12M3 12h18" /></svg>';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                    {activity.type === 'food' ? (
                      <Utensils className="w-8 h-8 text-gray-500" />
                    ) : activity.type === 'travel' ? (
                      <Car className="w-8 h-8 text-gray-500" />
                    ) : (
                      <Target className="w-8 h-8 text-gray-500" />
                    )}
                  </div>
                )}
              </div>

              <div
                className={`flex-1 cursor-pointer ${contentPaddingClass} overflow-hidden`}
                onClick={() => onActivityClick(activity)}
              >
                <div className="flex items-center justify-between mb-1.5 shrink-0 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${timeBadgeClass}`}
                    >
                      {activity.timeLine || '待定'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${typeConfig.bg} ${typeConfig.text} flex items-center gap-0.5`}
                    >
                      {activity.type === 'food' ? (
                        <Utensils className="w-3 h-3" />
                      ) : activity.type === 'travel' ? (
                        <Car className="w-3 h-3" />
                      ) : (
                        <Target className="w-3 h-3" />
                      )}
                      {typeConfig.label}
                    </span>
                    {isBooked && (
                      <span className="rounded-md border border-[var(--mint-strong)] bg-[var(--mint-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--mint-ink)] shrink-0">
                        已预订
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (isBooked) {
                        onActivityClick(activity);
                        return;
                      }
                      onToggleSelect?.(activity.id);
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all cursor-pointer active:scale-95 ml-2 shrink-0 ${selectButtonClass}`}
                    aria-label={isBooked ? '查看预订详情' : isSelected ? '取消选择' : '选择此项目'}
                  >
                    {(isBooked || isSelected) && (
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    )}
                  </button>
                </div>

                <div className="flex items-start justify-between mb-1 min-h-[22px]">
                  <h3
                    className={`mr-2 flex-1 text-[14px] font-black leading-tight transition-colors min-w-0 ${titleColorClass}`}
                  >
                    <span className="truncate block min-w-0">{activity.title}</span>
                    {isRomantic && (
                      <Heart className="inline-block w-3.5 h-3.5 ml-1.5 text-rose-400 fill-rose-400 shrink-0" />
                    )}
                  </h3>
                  <div
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md shrink-0 ${ratingBadgeClass}`}
                  >
                    <StarIcon className={`w-3 h-3 ${ratingTextClass}`} fill="currentColor" />
                    <span className={`text-[11px] font-black ${ratingTextClass}`}>{rating}</span>
                  </div>
                </div>

                <p
                  className={`text-[11px] leading-relaxed mb-2 line-clamp-2 text-[var(--app-text)]`}
                >
                  {activity.description}
                </p>

                {activity.tips && activity.tips.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {activity.tips.slice(0, 2).map((tip, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-1.5 text-[10px] font-medium leading-relaxed ${
                          tip.type === 'warning'
                            ? 'text-orange-600'
                            : tip.type === 'booking'
                              ? 'text-blue-600'
                              : 'text-gray-500'
                        }`}
                      >
                        {tip.type === 'warning' ? (
                          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        ) : tip.type === 'booking' ? (
                          <Calendar className="w-3 h-3 mt-0.5 shrink-0" />
                        ) : (
                          <Info className="w-3 h-3 mt-0.5 shrink-0" />
                        )}
                        <span className="line-clamp-1">{tip.content}</span>
                      </div>
                    ))}
                  </div>
                )}

                {isFamily && safetyTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {safetyTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1"
                      >
                        <Shield className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between min-h-[18px] min-w-0">
                  <div className="flex flex-wrap gap-1 flex-1 min-w-0 mr-2">
                    {(activity.tags || []).slice(0, maxTags).map((tag) => (
                      <span key={tag} className={`truncate ${tagClass} max-w-full`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-[12px] font-black text-[var(--app-ink)] shrink-0">
                    ¥{activity.price || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 px-3 pb-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer active:scale-95 ${navButtonClass}`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <Navigation className="w-3 h-3 shrink-0" />
                <span className="truncate">导航</span>
              </button>
              <button
                type="button"
                className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-200 cursor-pointer active:scale-95 ${actionButtonClass}`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (isBooked) {
                    onActivityClick(activity);
                    return;
                  }
                  onToggleSelect?.(activity.id);
                }}
              >
                <MapPin className={`w-3 h-3 shrink-0 ${isSelected ? 'animate-pulse' : ''}`} />
                <span className="truncate">
                  {isBooked ? '查看凭证' : isSelected ? '已加入执行' : '加入执行'}
                </span>
                {isSelected && <Check className="w-2.5 h-2.5 shrink-0" />}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.activity.id === nextProps.activity.id &&
      prevProps.activity.title === nextProps.activity.title &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isBooked === nextProps.isBooked &&
      prevProps.index === nextProps.index &&
      prevProps.variant === nextProps.variant &&
      prevProps.travelTime === nextProps.travelTime
    );
  }
);

export default ActivityCardComponent;
