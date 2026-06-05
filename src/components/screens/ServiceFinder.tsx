import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  Navigation,
  Tag,
  Ticket,
  Truck,
  Gift,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { CouponCardData, DeliveryCardData, TicketCardData } from '../cards/ServiceCards';
import GradientImg from '../ui/GradientImg';
import { QuickOrderSheet } from '../ui/QuickOrderSheet';
import { ResultCard, ResultCardData, ResultCardSkeleton } from '../cards/ResultCard';
import {
  searchSmartNearby,
  dataSource,
  searchInputTips,
  InputTip,
} from '../../services/apiAdapter';
import { getFeedImage } from '../../services/imageLibrary';
import { batchFetchPOIImages } from '../../services/poiImageService';
import { copyText, openMapSearch } from '../../services/clientActions';

type ServiceFinderMode = 'delivery' | 'ticket' | 'coupon';

interface ServiceFinderProps {
  mode: ServiceFinderMode;
  city?: string;
  keyword?: string;
  items: DeliveryCardData[] | TicketCardData[] | CouponCardData[];
  onBack: () => void;
  onSelect?: (item: DeliveryCardData | TicketCardData | CouponCardData) => void;
}

const modeConfig = {
  delivery: {
    title: '外卖',
    placeholder: '搜店铺、菜品、奶茶',
    tabs: ['全部', '正餐', '轻食', '甜品饮品'],
    chips: ['附近', '配送最快', '智能排序', '筛选'],
    accent: 'rose' as const,
    icon: <Truck className="w-5 h-5 text-[var(--rose-ink)]" />,
  },
  ticket: {
    title: '活动',
    placeholder: '搜演出、展览、门票',
    tabs: ['全部', '演出', '展览', '景点'],
    chips: ['本周', '热门优先', '智能排序', '筛选'],
    accent: 'mint' as const,
    icon: <Ticket className="w-5 h-5 text-[var(--mint-ink)]" />,
  },
  coupon: {
    title: '优惠',
    placeholder: '搜门店、券类型',
    tabs: ['全部', '餐饮券', '外卖券', '到店优惠'],
    chips: ['常用店铺', '可直接用', '智能排序', '筛选'],
    accent: 'brand' as const,
    icon: <Gift className="w-5 h-5 text-[var(--brand-ink)]" />,
  },
};

const RATING_MIN_THRESHOLD = 4.0;
const MAX_DELIVERY_FEE_THRESHOLD = 5;
const MAX_SPOTLIGHT_ITEMS = 4;
const MAX_RESULTS_DISPLAY = 15;
const MAX_TICKET_PRICE_THRESHOLD = 200;
const SEARCH_DEBOUNCE_MS = 300;

function resolveDeliveryTab(item: DeliveryCardData) {
  if (/奶茶|甜品/.test(item.category)) return '甜品饮品';
  if (/轻食/.test(item.category)) return '轻食';
  return '正餐';
}

function resolveTicketTab(item: TicketCardData) {
  if (/剧|演唱会|话剧|音乐/.test(item.name)) return '演出';
  if (/展|艺术/.test(item.name)) return '展览';
  return '景点';
}

function resolveCouponTab(item: CouponCardData) {
  if (/外卖/.test(item.category)) return '外卖券';
  if (/到店|套餐/.test(item.category)) return '到店优惠';
  return '餐饮券';
}

type ServiceItem = DeliveryCardData | TicketCardData | CouponCardData;

function isDeliveryCard(item: ServiceItem): item is DeliveryCardData {
  return 'deliveryTime' in item;
}

function isTicketCard(item: ServiceItem): item is TicketCardData {
  return 'venue' in item;
}

function isCouponCard(item: ServiceItem): item is CouponCardData {
  return 'shopName' in item;
}

function normalizeServiceQuery(mode: ServiceFinderMode, text: string) {
  const q = text.trim();
  if (!q) return mode === 'delivery' ? '外卖' : mode === 'ticket' ? '展览 演出 景点' : '美食 优惠';
  if (mode === 'delivery') {
    if (/奶茶|甜品|咖啡/.test(q)) return '奶茶 甜品 咖啡';
    if (/轻食|沙拉/.test(q)) return '轻食 沙拉';
    return (
      q
        .replace(/帮我|推荐|点个|点份|现在|附近|适合|想吃|找|一下/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || '外卖'
    );
  }
  if (mode === 'ticket') {
    if (/电影/.test(q)) return '电影院 电影';
    if (/展|艺术/.test(q)) return '展览 美术馆 博物馆';
    if (/演出|话剧|音乐|live/.test(q)) return '剧院 演出';
    return (
      q
        .replace(/帮我|找|推荐|附近|适合|现在|可以去|活动|一下/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || '展览 演出 景点'
    );
  }
  return (
    q
      .replace(/帮我|找|推荐|现在能用的|现在|可以用的|优惠券|折扣|一下/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || '美食 优惠'
  );
}

export default function ServiceFinder({
  mode,
  city = '北京',
  keyword = '',
  items,
  onBack,
  onSelect,
}: ServiceFinderProps) {
  const config = modeConfig[mode];
  const [activeTab, setActiveTab] = useState('全部');
  const [activeChip, setActiveChip] = useState(config.chips[2]);
  const [searchValue, setSearchValue] = useState('');
  const [committedKeyword, setCommittedKeyword] = useState('');
  const [remoteItems, setRemoteItems] = useState<
    Array<DeliveryCardData | TicketCardData | CouponCardData>
  >([]);
  const [inputTips, setInputTips] = useState<InputTip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [claimedCouponIds, setClaimedCouponIds] = useState<string[]>([]);
  const normalizedQuery = normalizeServiceQuery(mode, committedKeyword || keyword);
  const hasInitialItems = items.length > 0;
  const hasSearchedRef = useRef(false);
  const [quickOrderDeliveryItem, setQuickOrderDeliveryItem] = useState<DeliveryCardData | null>(
    null
  );

  useEffect(() => {
    let alive = true;

    async function loadRemoteItems() {
      if (!dataSource.hasAmap) {
        setRemoteItems([]);
        return;
      }

      if (hasInitialItems && !hasSearchedRef.current) {
        setRemoteItems([]);
        return;
      }

      const term = normalizedQuery;
      setIsLoading(true);
      setError(null);
      try {
        const pois = await searchSmartNearby(term, city, 5000);
        if (!alive || !pois.length) return;

        const sliced = pois.slice(0, 20);
        const imageMap = await batchFetchPOIImages(
          sliced.map((poi) => ({ name: poi.name, city, poiId: poi.id }))
        );

        if (mode === 'delivery') {
          const next = sliced.map((poi, index) => {
            const rating = parseFloat(poi.rating);
            const cost = Number(poi.cost);
            return {
              id: `amap_delivery_${index}`,
              name: poi.name,
              category: (poi.type ?? '').split(';')[0] || '外卖',
              rating: isNaN(rating) ? 0 : rating,
              deliveryTime: poi.openTime ? '营业中' : '约30分钟',
              deliveryFee: cost > 0 ? Math.max(3, Math.round(cost / 25)) : 5,
              avgPrice: cost > 0 ? cost : 35,
              tags: [(poi.type ?? '').split(';')[1] || '餐饮', '高德推荐'],
              image:
                imageMap.get(poi.name) ||
                getFeedImage(`${poi.name} 外卖 ${poi.type}`, `amap_delivery_${index}`),
              poiId: poi.id,
              address: poi.address,
              businessArea: poi.businessArea,
              phone: poi.phone !== '暂无' ? poi.phone : undefined,
            };
          }) satisfies DeliveryCardData[];
          setRemoteItems(next);
          return;
        }

        if (mode === 'ticket') {
          const next = sliced.map((poi, index) => {
            const rating = parseFloat(poi.rating);
            const cost = Number(poi.cost);
            return {
              id: `amap_ticket_${index}`,
              name: poi.name,
              venue: poi.businessArea || poi.address || city,
              date: poi.openTime ? '营业中' : '全天',
              time: poi.openTime || '详询场馆',
              price: isNaN(cost) ? 0 : cost,
              rating: isNaN(rating) ? 0 : rating,
              tags: [poi.type?.split(';')[0] || '活动', '高德推荐'],
              image:
                imageMap.get(poi.name) ||
                getFeedImage(`${poi.name} 活动 ${poi.type}`, `amap_ticket_${index}`),
              poiId: poi.id,
              openTime: poi.openTime,
              address: poi.address,
              type: poi.type,
            };
          }) satisfies TicketCardData[];
          setRemoteItems(next);
          return;
        }

        const next = sliced.map((poi, index) => {
          const cost = Number(poi.cost);
          return {
            id: `amap_coupon_${index}`,
            shopName: poi.name,
            discount: isNaN(cost) ? '7折' : `¥${Math.max(10, Math.floor(cost / 5))}`,
            condition: index % 2 === 0 ? '满100可用' : '指定套餐可用',
            validUntil: '今日可用',
            category: (poi.type ?? '').split(';')[0] || '餐饮券',
          };
        }) satisfies CouponCardData[];
        setRemoteItems(next);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'POI 搜索失败，请稍后重试');
      } finally {
        if (alive) setIsLoading(false);
      }
    }

    void loadRemoteItems();
    return () => {
      alive = false;
    };
  }, [mode, city, keyword, normalizedQuery, hasInitialItems, retryCount]);

  useEffect(() => {
    let alive = true;

    async function fetchTips() {
      if (!dataSource.hasAmap || !searchValue.trim()) {
        setInputTips([]);
        return;
      }

      const tips = await searchInputTips(searchValue, city);
      if (alive) {
        setInputTips(tips);
      }
    }

    const timer = setTimeout(fetchTips, SEARCH_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [searchValue, city]);

  const effectiveItems = remoteItems.length > 0 ? remoteItems : items;

  const filteredItems = useMemo(() => {
    const query = normalizedQuery.toLowerCase();
    let next = effectiveItems.filter((rawItem) => {
      if (mode === 'delivery') {
        if (!isDeliveryCard(rawItem)) return false;
        const tabMatched = activeTab === '全部' || resolveDeliveryTab(rawItem) === activeTab;
        const searchMatched =
          !query ||
          `${rawItem.name} ${rawItem.category} ${rawItem.tags.join(' ')}`
            .toLowerCase()
            .includes(query);
        return tabMatched && searchMatched;
      }

      if (mode === 'ticket') {
        if (!isTicketCard(rawItem)) return false;
        const tabMatched = activeTab === '全部' || resolveTicketTab(rawItem) === activeTab;
        const searchMatched =
          !query ||
          `${rawItem.name} ${rawItem.venue} ${rawItem.tags.join(' ')}`
            .toLowerCase()
            .includes(query);
        return tabMatched && searchMatched;
      }

      if (!isCouponCard(rawItem)) return false;
      const tabMatched = activeTab === '全部' || resolveCouponTab(rawItem) === activeTab;
      const searchMatched =
        !query ||
        `${rawItem.shopName} ${rawItem.category} ${rawItem.discount} ${rawItem.condition}`
          .toLowerCase()
          .includes(query);
      return tabMatched && searchMatched;
    });

    if (mode === 'delivery') {
      if (activeChip === '附近' || activeChip === '配送最快') {
        next = [...next].sort((a, b) => {
          if (!isDeliveryCard(a) || !isDeliveryCard(b)) return 0;
          const left = parseInt(a.deliveryTime, 10) || 99;
          const right = parseInt(b.deliveryTime, 10) || 99;
          return left - right;
        });
      } else if (activeChip === '筛选') {
        next = next.filter(
          (item) =>
            isDeliveryCard(item) &&
            item.rating >= RATING_MIN_THRESHOLD &&
            item.deliveryFee <= MAX_DELIVERY_FEE_THRESHOLD
        );
      } else if (activeChip === '智能排序') {
        next = [...next].sort((a, b) => {
          if (!isDeliveryCard(a) || !isDeliveryCard(b)) return 0;
          const scoreA = (a.rating || 0) * 20 - a.deliveryFee;
          const scoreB = (b.rating || 0) * 20 - b.deliveryFee;
          return scoreB - scoreA;
        });
      }
    } else if (mode === 'ticket') {
      if (activeChip === '本周') {
        next = next.filter((item) => isTicketCard(item) && item.date.includes('本周'));
      } else if (activeChip === '热门优先' || activeChip === '智能排序') {
        next = [...next].sort((a, b) => {
          if (!isTicketCard(a) || !isTicketCard(b)) return 0;
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          return ratingB - ratingA;
        });
      } else if (activeChip === '筛选') {
        next = next.filter(
          (item) =>
            isTicketCard(item) && (item.price <= MAX_TICKET_PRICE_THRESHOLD || item.price === 0)
        );
      }
    } else {
      if (activeChip === '常用店铺') {
        next = [...next].sort((a, b) => {
          if (!isCouponCard(a) || !isCouponCard(b)) return 0;
          return a.shopName.localeCompare(b.shopName, 'zh-CN');
        });
      } else if (activeChip === '可直接用') {
        next = next.filter((item) => isCouponCard(item) && item.validUntil.includes('今日'));
      } else if (activeChip === '筛选') {
        // 不做特殊筛选
      }
    }

    return next.length > 0 ? next : effectiveItems;
  }, [effectiveItems, activeTab, normalizedQuery, mode, activeChip]);

  const spotlight = useMemo(() => filteredItems.slice(0, MAX_SPOTLIGHT_ITEMS), [filteredItems]);
  const listItems = useMemo(() => filteredItems.slice(0, MAX_RESULTS_DISPLAY), [filteredItems]);
  const couponHighlights = useMemo(
    () => (mode === 'coupon' ? ['神券膨胀', '到店立减', '外卖红包', '限时折扣'] : []),
    [mode]
  );
  const accentClass = useMemo(
    () =>
      config.accent === 'rose'
        ? 'border-[var(--rose-strong)] text-[var(--rose-ink)] bg-[var(--rose-soft)]'
        : config.accent === 'mint'
          ? 'border-[var(--mint-strong)] text-[var(--mint-ink)] bg-[var(--mint-soft)]'
          : 'border-[#ffe2a3] text-[var(--brand-ink)] bg-[var(--brand-soft)]',
    [config.accent]
  );
  const buttonClass = useMemo(
    () =>
      config.accent === 'rose'
        ? 'bg-[var(--rose-ink)] text-white'
        : config.accent === 'mint'
          ? 'bg-[var(--mint-ink)] text-white'
          : 'bg-[var(--brand)] text-[var(--brand-ink)]',
    [config.accent]
  );

  return (
    <div className="flex h-full flex-col bg-transparent overflow-hidden">
      <div className="px-4 pt-14 pb-4 bg-white/82 backdrop-blur-xl border-b border-[var(--app-border)] shadow-[0_6px_18px_rgba(20,24,33,0.04)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="app-pill w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
              aria-label="返回"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--app-ink)]" />
            </button>
            <div className="flex items-center gap-1.5">
              <h1 className="text-[22px] font-bold text-[var(--app-ink)]">{config.title}</h1>
              <div className="flex items-center gap-0.5 text-[var(--app-text)]">
                <MapPin className="w-4 h-4" />
                <span className="text-[13px] font-bold">{city}</span>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
          <button
            onClick={() => openMapSearch(`${city} ${normalizedQuery || config.title}`)}
            className="app-pill w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
            aria-label="在地图搜索"
          >
            {config.icon}
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--app-text-soft)]" />
          <input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                hasSearchedRef.current = true;
                setCommittedKeyword(searchValue);
                setInputTips([]);
              }
            }}
            placeholder={config.placeholder}
            className={`w-full h-14 rounded-full border-2 bg-white pl-12 pr-24 text-[15px] font-medium text-[var(--app-ink)] outline-none shadow-[0_8px_18px_rgba(20,24,33,0.04)] ${accentClass}`}
          />
          <button
            onClick={() => {
              hasSearchedRef.current = true;
              setCommittedKeyword(searchValue);
              setInputTips([]);
            }}
            className={`absolute right-1.5 top-1.5 h-11 rounded-full px-6 text-[15px] font-bold active:scale-95 ${buttonClass} shadow-[0_8px_18px_rgba(20,24,33,0.08)]`}
          >
            搜索
          </button>

          {inputTips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-[0_12px_32px_rgba(20,24,33,0.12)] border border-[var(--app-border)] z-10 overflow-hidden"
            >
              {inputTips.map((tip, index) => (
                <button
                  key={tip.id}
                  onClick={() => {
                    setSearchValue(tip.name);
                    hasSearchedRef.current = true;
                    setCommittedKeyword(tip.name);
                    setInputTips([]);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--app-card-soft)] transition-colors"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Search className="w-4 h-4 text-[var(--app-text-soft)]" />
                  <div className="text-left flex-1">
                    <div className="text-sm font-medium text-[var(--app-ink)]">{tip.name}</div>
                    {tip.address && (
                      <div className="text-xs text-[var(--app-text-soft)] truncate">
                        {tip.address}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="px-4 pt-4">
          <div
            className={`rounded-[24px] border px-4 py-4 shadow-[0_8px_24px_rgba(31,41,55,0.04)] ${
              mode === 'delivery'
                ? 'border-[var(--rose-strong)] bg-[linear-gradient(135deg,rgba(255,247,251,0.96)_0%,rgba(255,231,241,0.84)_100%)]'
                : mode === 'ticket'
                  ? 'border-[var(--mint-strong)] bg-[linear-gradient(135deg,rgba(245,255,250,0.96)_0%,rgba(238,248,241,0.84)_100%)]'
                  : 'border-[#ffe2a3] bg-[linear-gradient(135deg,rgba(255,249,235,0.98)_0%,rgba(255,244,191,0.76)_100%)]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold ${accentClass}`}
                >
                  荐
                </div>
                <span className="text-[13px] font-bold text-[var(--app-ink)]">为你精选</span>
              </div>
              <div className="flex items-center gap-2">
                {isLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--app-text-soft)]" />
                )}
                <span className="text-[13px] font-bold text-[var(--app-text-soft)]">
                  {filteredItems.length} 个结果
                </span>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${dataSource.hasAmap ? 'bg-[var(--sky-soft)] text-[var(--sky-ink)]' : 'bg-[var(--warning-soft)] text-[var(--warning-ink)]'}`}
              >
                {dataSource.hasAmap ? '高德地图 · 实时POI' : '本地推荐整理'}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--app-text)] border border-[var(--app-border)]">
                {mode === 'delivery' ? '附近优先' : mode === 'ticket' ? '本周可去' : '可直接领取'}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--app-text)] border border-[var(--app-border)]">
                {mode === 'delivery' ? '高分优先' : mode === 'ticket' ? '热门优先' : '常用店铺'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {spotlight.map((rawItem, index) => {
                if (mode === 'delivery' && isDeliveryCard(rawItem)) {
                  return (
                    <button
                      key={rawItem.id}
                      onClick={() => onSelect?.(rawItem)}
                      className="rounded-2xl bg-white p-2.5 border border-[var(--rose-strong)] shadow-[0_6px_18px_rgba(201,75,134,0.06)] text-left active:scale-[0.98] transition-transform"
                    >
                      <div className="relative h-[86px] rounded-xl overflow-hidden mb-2.5 bg-[var(--app-card-soft)]">
                        <GradientImg
                          src={rawItem.image}
                          alt={rawItem.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-[13px] font-bold text-[var(--app-ink)] line-clamp-1">
                        {rawItem.name}
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--app-text-soft)] font-bold">
                        {rawItem.deliveryTime}送达
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-[var(--rose-ink)] shrink-0">
                          配送¥{rawItem.deliveryFee}
                        </span>
                        {rawItem.avgPrice > 0 && (
                          <span className="text-[13px] text-[var(--app-text-soft)] shrink-0">
                            ¥{rawItem.avgPrice}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                }

                if (mode === 'ticket' && isTicketCard(rawItem)) {
                  return (
                    <button
                      key={rawItem.id}
                      onClick={() => onSelect?.(rawItem)}
                      className="rounded-2xl bg-white p-2.5 border border-[var(--mint-strong)] shadow-[0_6px_18px_rgba(42,162,122,0.06)] text-left active:scale-[0.98] transition-transform"
                    >
                      <div className="relative h-[86px] rounded-xl overflow-hidden mb-2.5 bg-[var(--app-card-soft)]">
                        <GradientImg
                          src={rawItem.image}
                          alt={rawItem.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-[13px] font-bold text-[var(--app-ink)] line-clamp-1">
                        {rawItem.name}
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--app-text-soft)] font-bold">
                        {rawItem.date} · {rawItem.time}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        {rawItem.price > 0 && (
                          <span className="text-[13px] font-bold text-[var(--mint-ink)] shrink-0">
                            ¥{rawItem.price}起
                          </span>
                        )}
                        <span className="text-[13px] text-[var(--app-text-soft)] truncate min-w-0">
                          {rawItem.venue}
                        </span>
                      </div>
                    </button>
                  );
                }

                if (!isCouponCard(rawItem)) return null;
                const isClaimed = claimedCouponIds.includes(rawItem.id);
                return (
                  <button
                    key={rawItem.id}
                    onClick={() => {
                      if (!isClaimed) {
                        setClaimedCouponIds((prev) => [...prev, rawItem.id]);
                        void copyText(
                          `${rawItem.shopName} ${rawItem.discount} ${rawItem.condition}`
                        );
                      }
                      onSelect?.(rawItem);
                    }}
                    className="rounded-2xl bg-white p-3 border border-[#ffe2a3] shadow-[0_6px_18px_rgba(255,200,58,0.1)] text-left active:scale-[0.98] transition-transform overflow-hidden relative"
                  >
                    <div className="absolute top-2 right-2 rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[10px] font-bold text-[var(--brand-ink)]">
                      {isClaimed ? '已领取' : '限时可领'}
                    </div>
                    <div className="text-[22px] font-bold text-[var(--brand-ink)] leading-none">
                      {rawItem.discount}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--app-text-soft)] font-bold line-clamp-1">
                      {rawItem.condition}
                    </div>
                    <div className="mt-4 text-[13px] font-bold text-[var(--app-ink)] line-clamp-1">
                      {rawItem.shopName}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--app-text-soft)] font-bold line-clamp-1">
                        {rawItem.validUntil}
                      </span>
                      <span className="text-[11px] font-bold text-[var(--brand-ink)] shrink-0">
                        {isClaimed ? '去使用' : '去领取'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 px-4">
          <div className="flex items-center gap-7 overflow-x-auto scrollbar-none pb-3">
            {config.tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative whitespace-nowrap text-[15px] font-bold ${activeTab === tab ? 'text-[var(--app-ink)]' : 'text-[var(--app-text)]'}`}
              >
                {tab}
                {activeTab === tab && (
                  <div
                    className={`absolute -bottom-2 left-0 right-0 h-1 rounded-full ${buttonClass}`}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none pb-2">
            {config.chips.map((chip) => (
              <button
                key={chip}
                onClick={() => setActiveChip(chip)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-2xl border px-4 py-2 text-[13px] font-bold ${
                  activeChip === chip
                    ? config.accent === 'rose'
                      ? 'border-[var(--rose-strong)] bg-[var(--rose-soft)] text-[var(--rose-ink)]'
                      : config.accent === 'mint'
                        ? 'border-[var(--mint-strong)] bg-[var(--mint-soft)] text-[var(--mint-ink)]'
                        : 'border-[#ffe2a3] bg-[var(--brand-soft)] text-[var(--brand-ink)]'
                    : 'border-[var(--app-border)] bg-white text-[var(--app-ink)]'
                }`}
              >
                {chip}
                {chip === '筛选' ? (
                  <SlidersHorizontal className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            ))}
          </div>
        </div>

        {isLoading && listItems.length === 0 ? (
          <div className="mt-4 px-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <ResultCardSkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        ) : (
          <div className="mt-4 px-4 space-y-3">
            {listItems.map((rawItem) => {
              if (mode === 'delivery' && isDeliveryCard(rawItem)) {
                const cardData: ResultCardData = {
                  id: rawItem.id,
                  name: rawItem.name,
                  image: rawItem.image,
                  rating: rawItem.rating,
                  avgPrice: rawItem.avgPrice,
                  category: rawItem.category,
                  tags: rawItem.tags,
                  deliveryFee: rawItem.deliveryFee,
                  deliveryTime: rawItem.deliveryTime,
                };
                return (
                  <ResultCard
                    key={rawItem.id}
                    type="delivery"
                    data={cardData}
                    onSelect={(data) => onSelect?.(rawItem)}
                    onQuickOrder={onSelect ? () => setQuickOrderDeliveryItem(rawItem) : undefined}
                  />
                );
              }

              if (mode === 'ticket' && isTicketCard(rawItem)) {
                const cardData: ResultCardData = {
                  id: rawItem.id,
                  name: rawItem.name,
                  image: rawItem.image,
                  rating: rawItem.rating,
                  price: rawItem.price,
                  venue: rawItem.venue,
                  date: rawItem.date,
                  time: rawItem.time,
                  tags: rawItem.tags,
                };
                return (
                  <ResultCard
                    key={rawItem.id}
                    type="ticket"
                    data={cardData}
                    onSelect={(data) => onSelect?.(rawItem)}
                  />
                );
              }

              if (!isCouponCard(rawItem)) return null;
              const cardData: ResultCardData = {
                id: rawItem.id,
                name: rawItem.shopName,
                discount: rawItem.discount,
                condition: rawItem.condition,
                date: rawItem.validUntil,
                category: rawItem.category,
              };
              return (
                <ResultCard
                  key={rawItem.id}
                  type="coupon"
                  data={cardData}
                  onSelect={(data) => onSelect?.(rawItem)}
                />
              );
            })}
          </div>
        )}

        {!isLoading && !error && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Search className="w-10 h-10 text-[var(--app-text-soft)] mb-3" />
            <div className="text-[13px] font-bold text-[var(--app-text-soft)]">
              {mode === 'delivery'
                ? '未找到符合条件的外卖'
                : mode === 'ticket'
                  ? '未找到符合条件的活动'
                  : '未找到符合条件的优惠券'}
            </div>
            <div className="mt-1 text-[13px] font-bold text-[var(--app-text-soft)]">
              试试调整筛选条件或换个关键词
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 px-4 mx-4 mt-4 rounded-[24px] bg-[var(--danger-soft)] border border-[#ffd6dd]">
            <AlertCircle className="w-10 h-10 text-[var(--danger-ink)] mb-3" />
            <div className="text-[13px] font-bold text-[var(--app-ink)] mb-1">数据加载失败</div>
            <div className="text-[13px] font-bold text-[var(--app-text-soft)] mb-4 max-w-[240px] text-center">
              {error}
            </div>
            <button
              onClick={() => {
                setError(null);
                hasSearchedRef.current = true;
                setRetryCount((c) => c + 1);
              }}
              className="app-btn-primary rounded-full px-6 py-2.5 text-[13px] font-bold active:scale-95"
            >
              重试
            </button>
          </div>
        )}
      </div>
      <QuickOrderSheet
        isOpen={!!quickOrderDeliveryItem}
        onClose={() => setQuickOrderDeliveryItem(null)}
        data={
          quickOrderDeliveryItem
            ? {
                id: quickOrderDeliveryItem.id,
                name: quickOrderDeliveryItem.name,
                avgPrice: quickOrderDeliveryItem.avgPrice,
                image: quickOrderDeliveryItem.image,
              }
            : null
        }
        type="delivery"
        onConfirm={(_data, _qty) => {
          setQuickOrderDeliveryItem(null);
          onSelect?.(quickOrderDeliveryItem!);
        }}
      />
    </div>
  );
}
