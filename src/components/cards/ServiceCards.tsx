import React from 'react';
import { motion } from 'motion/react';
import {
  Sun,
  Utensils,
  Truck,
  Ticket,
  MapPin,
  Sparkles,
  ShoppingBag,
  Building2,
  Landmark,
  Film,
  Zap,
  Route,
  CalendarCheck,
} from 'lucide-react';
import XiaoMeiAvatar from '../mascot/XiaoMeiAvatar';
import type { Activity } from '../../services/ai';

export { WeatherCard, type WeatherCardData } from './WeatherCard';
export { RestaurantCarousel, type RestaurantCardData } from './RestaurantCard';
export { DeliveryCarousel, type DeliveryCardData } from './DeliveryCard';
export { TicketCarousel, type TicketCardData } from './TicketCard';
export { CouponList, type CouponCardData } from './CouponCard';

export type ServiceCardData =
  | { type: 'weather'; data: import('./WeatherCard').WeatherCardData }
  | { type: 'restaurant'; data: import('./RestaurantCard').RestaurantCardData[] }
  | { type: 'delivery'; data: import('./DeliveryCard').DeliveryCardData[] }
  | { type: 'ticket'; data: import('./TicketCard').TicketCardData[] }
  | { type: 'coupon'; data: import('./CouponCard').CouponCardData[] }
  | { type: 'plan'; data: Activity[]; planTitle: string; summary: string; totalPrice: number };

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  query: string;
  gradient: string;
  iconColor: string;
  borderColor: string;
  textColor: string;
  shadow: string;
}

const quickActions: QuickAction[] = [
  {
    icon: <Sun className="w-4 h-4" />,
    label: '天气',
    query: '今天天气怎么样',
    gradient: 'from-[var(--sky-soft)] to-[#dfe8f4]',
    iconColor: 'text-[var(--sky-ink)]',
    borderColor: 'border-[var(--sky-strong)]',
    textColor: 'text-[var(--sky-ink)]',
    shadow: 'shadow-[0_6px_18px_rgba(107,125,152,0.08)]',
  },
  {
    icon: <Utensils className="w-4 h-4" />,
    label: '找餐厅',
    query: '附近有什么好吃的餐厅',
    gradient: 'from-[var(--peach-soft)] to-[#ffe8cf]',
    iconColor: 'text-[var(--peach-ink)]',
    borderColor: 'border-[var(--peach-strong)]',
    textColor: 'text-[var(--peach-ink)]',
    shadow: 'shadow-[0_6px_18px_rgba(217,139,76,0.08)]',
  },
  {
    icon: <Truck className="w-4 h-4" />,
    label: '点外卖',
    query: '帮我推荐外卖',
    gradient: 'from-[var(--rose-soft)] to-[#ffdce9]',
    iconColor: 'text-[var(--rose-ink)]',
    borderColor: 'border-[var(--rose-strong)]',
    textColor: 'text-[var(--rose-ink)]',
    shadow: 'shadow-[0_6px_18px_rgba(201,75,134,0.08)]',
  },
  {
    icon: <Ticket className="w-4 h-4" />,
    label: '电影',
    query: '最近有什么好看的电影',
    gradient: 'from-[var(--mint-soft)] to-[#dff0e6]',
    iconColor: 'text-[var(--mint-ink)]',
    borderColor: 'border-[var(--mint-strong)]',
    textColor: 'text-[var(--mint-ink)]',
    shadow: 'shadow-[0_6px_18px_rgba(42,162,122,0.08)]',
  },
  {
    icon: <MapPin className="w-4 h-4" />,
    label: '景点',
    query: '附近有什么好玩的景点',
    gradient: 'from-[var(--sky-soft)] to-[#e6edf7]',
    iconColor: 'text-[var(--sky-ink)]',
    borderColor: 'border-[var(--sky-strong)]',
    textColor: 'text-[var(--sky-ink)]',
    shadow: 'shadow-[0_6px_18px_rgba(107,125,152,0.08)]',
  },
  {
    icon: <Sparkles className="w-4 h-4" />,
    label: '规划',
    query: '帮我规划周末行程',
    gradient: 'from-[var(--brand-soft)] to-[var(--brand)]',
    iconColor: 'text-[var(--brand-ink)]',
    borderColor: 'border-[#ffe2a3]',
    textColor: 'text-[var(--brand-ink)]',
    shadow: 'shadow-[0_6px_18px_rgba(255,200,58,0.14)]',
  },
];

export function QuickActions({
  onSelect,
  compact,
}: {
  onSelect: (action: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex gap-2 ${compact ? 'overflow-x-auto scrollbar-none pb-0.5' : 'flex-wrap justify-center'} ${compact ? 'snap-x' : ''}`}
    >
      {quickActions.map((action, i) => (
        <motion.button
          key={action.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04, duration: 0.25 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onSelect(action.query)}
          className={`flex items-center gap-1.5 bg-white rounded-full border ${action.borderColor} ${action.shadow} active:scale-90 transition-all cursor-pointer shrink-0 snap-center ${
            compact ? 'px-3 py-2' : 'px-3.5 py-2.5'
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-sm`}
          >
            <span className={action.iconColor}>{action.icon}</span>
          </div>
          <span
            className={`font-bold whitespace-nowrap ${action.textColor} ${compact ? 'text-[11px]' : 'text-[13px]'}`}
          >
            {action.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

interface ServiceItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  gradient: string;
  iconColor: string;
  borderColor: string;
  textColor: string;
  shadow: string;
}

const serviceItems: ServiceItem[] = [
  {
    id: 'food',
    label: '美食',
    icon: <Utensils className="w-5 h-5" />,
    gradient: 'from-[var(--peach-soft)] to-[#ffe8cf]',
    iconColor: 'text-[var(--peach-ink)]',
    borderColor: 'border-[var(--peach-strong)]',
    textColor: 'text-[var(--peach-ink)]',
    shadow: 'shadow-[0_8px_20px_rgba(217,139,76,0.08)]',
  },
  {
    id: 'shopping',
    label: '闪购',
    icon: <ShoppingBag className="w-5 h-5" />,
    gradient: 'from-[var(--rose-soft)] to-[#ffe0eb]',
    iconColor: 'text-[var(--rose-ink)]',
    borderColor: 'border-[var(--rose-strong)]',
    textColor: 'text-[var(--rose-ink)]',
    shadow: 'shadow-[0_8px_20px_rgba(201,75,134,0.08)]',
  },
  {
    id: 'hotel',
    label: '酒店',
    icon: <Building2 className="w-5 h-5" />,
    gradient: 'from-[var(--sky-soft)] to-[#e3ebf7]',
    iconColor: 'text-[var(--sky-ink)]',
    borderColor: 'border-[var(--sky-strong)]',
    textColor: 'text-[var(--sky-ink)]',
    shadow: 'shadow-[0_8px_20px_rgba(107,125,152,0.08)]',
  },
  {
    id: 'leisure',
    label: '休闲玩乐',
    icon: <Zap className="w-5 h-5" />,
    gradient: 'from-[var(--brand-soft)] to-[#ffe9a2]',
    iconColor: 'text-[var(--brand-ink)]',
    borderColor: 'border-[#ffe2a3]',
    textColor: 'text-[var(--brand-ink)]',
    shadow: 'shadow-[0_8px_20px_rgba(255,200,58,0.12)]',
  },
  {
    id: 'tickets',
    label: '景点/门票',
    icon: <Landmark className="w-5 h-5" />,
    gradient: 'from-[var(--mint-soft)] to-[#e2f1e8]',
    iconColor: 'text-[var(--mint-ink)]',
    borderColor: 'border-[var(--mint-strong)]',
    textColor: 'text-[var(--mint-ink)]',
    shadow: 'shadow-[0_8px_20px_rgba(42,162,122,0.08)]',
  },
  {
    id: 'movies',
    label: '电影/演出',
    icon: <Film className="w-5 h-5" />,
    gradient: 'from-[var(--sky-soft)] to-[#e8edf8]',
    iconColor: 'text-[var(--sky-ink)]',
    borderColor: 'border-[var(--sky-strong)]',
    textColor: 'text-[var(--sky-ink)]',
    shadow: 'shadow-[0_8px_20px_rgba(107,125,152,0.08)]',
  },
];

export function ServiceGrid({ onServiceClick }: { onServiceClick?: (serviceId: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {serviceItems.map((item, i) => (
        <motion.button
          key={item.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => onServiceClick?.(item.id)}
          className={`flex flex-col items-center gap-2 bg-white rounded-[24px] py-4 border ${item.borderColor} ${item.shadow} active:scale-95 transition-all cursor-pointer`}
        >
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-sm`}
          >
            <span className={item.iconColor}>{item.icon}</span>
          </div>
          <span className={`text-[13px] font-bold ${item.textColor}`}>{item.label}</span>
        </motion.button>
      ))}
    </div>
  );
}

interface QuickServiceAction {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  gradient: string;
  iconColor: string;
  borderColor: string;
  titleColor: string;
  sublabelColor: string;
  shadow: string;
}

const quickServiceActions: QuickServiceAction[] = [
  {
    id: 'ai-plan',
    label: 'AI 行程规划',
    sublabel: '智能定制专属路线',
    icon: <XiaoMeiAvatar mood="smile" size="w-8 h-8" />,
    gradient: 'from-[var(--brand-soft)] to-[var(--brand)]',
    iconColor: 'text-[var(--brand-ink)]',
    borderColor: 'border-[#ffe2a3]',
    titleColor: 'text-[var(--brand-ink)]',
    sublabelColor: 'text-[#8f6b00]',
    shadow: 'shadow-[0_8px_20px_rgba(255,200,58,0.12)]',
  },
  {
    id: 'route',
    label: '路线推荐',
    sublabel: '精选热门出行方案',
    icon: <Route className="w-5 h-5" />,
    gradient: 'from-[var(--sky-soft)] to-[#e3ebf7]',
    iconColor: 'text-[var(--sky-ink)]',
    borderColor: 'border-[var(--sky-strong)]',
    titleColor: 'text-[var(--sky-ink)]',
    sublabelColor: 'text-[#7e8ca3]',
    shadow: 'shadow-[0_8px_20px_rgba(107,125,152,0.08)]',
  },
  {
    id: 'activity',
    label: '活动安排',
    sublabel: '发现周边精彩活动',
    icon: <CalendarCheck className="w-5 h-5" />,
    gradient: 'from-[var(--mint-soft)] to-[#e2f1e8]',
    iconColor: 'text-[var(--mint-ink)]',
    borderColor: 'border-[var(--mint-strong)]',
    titleColor: 'text-[var(--mint-ink)]',
    sublabelColor: 'text-[#6f9d8d]',
    shadow: 'shadow-[0_8px_20px_rgba(42,162,122,0.08)]',
  },
];

export function QuickServiceActions({
  onServiceClick,
}: {
  onServiceClick?: (serviceId: string) => void;
}) {
  return (
    <div className="flex gap-2.5">
      {quickServiceActions.map((item, i) => (
        <motion.button
          key={item.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.3 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onServiceClick?.(item.id)}
          className={`flex-1 flex items-center gap-2.5 bg-white rounded-2xl p-3 border ${item.borderColor} ${item.shadow} active:scale-95 transition-all cursor-pointer`}
        >
          <div
            className={`w-10 h-10 rounded-[12px] bg-gradient-to-br ${item.gradient} flex items-center justify-center shrink-0 shadow-sm`}
          >
            <span className={item.iconColor}>{item.icon}</span>
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className={`text-[13px] font-bold whitespace-nowrap ${item.titleColor}`}>
              {item.label}
            </span>
            <span className={`text-[10px] font-bold whitespace-nowrap ${item.sublabelColor}`}>
              {item.sublabel}
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
