import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  Navigation,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { RestaurantCardData } from '../cards/ServiceCards';
import GradientImg from '../ui/GradientImg';
import { QuickOrderSheet } from '../ui/QuickOrderSheet';
import { ResultCard, ResultCardData, ResultCardSkeleton } from '../cards/ResultCard';
import {
  dataSource,
  searchSmartNearby,
  searchInputTips,
  InputTip,
} from '../../services/apiAdapter';
import { getFeedImage } from '../../services/imageLibrary';
import { batchFetchPOIImages } from '../../services/poiImageService';
import { openMapSearch } from '../../services/clientActions';

interface RestaurantFinderProps {
  items: RestaurantCardData[];
  city?: string;
  keyword?: string;
  onBack: () => void;
  onSelect: (item: RestaurantCardData) => void;
}

const categoryTabs = ['全部', '美食餐厅', '奶茶咖啡', '快餐小吃', '休闲小食'];
const filterChips = ['附近', '全部美食', '智能排序', '筛选'];

const RATING_MIN_THRESHOLD = 4.0;
const PRICE_MAX_THRESHOLD = 150;
const MAX_SPOTLIGHT_ITEMS = 4;
const MAX_RESULTS_DISPLAY = 15;
const SEARCH_DEBOUNCE_MS = 300;

function resolveCategoryTab(item: RestaurantCardData) {
  if (/咖啡|下午茶|甜品|Brunch/i.test(item.category) || /咖啡|甜品|拿铁/.test(item.name))
    return '奶茶咖啡';
  if (/小吃|快餐/.test(item.category)) return '快餐小吃';
  if (/甜品|小食/.test(item.category)) return '休闲小食';
  return '美食餐厅';
}

function normalizeRestaurantQuery(text: string) {
  const q = text.trim();
  if (!q) return '餐厅';
  if (/咖啡|下午茶|甜品|奶茶/.test(q)) return '咖啡馆 下午茶';
  if (/火锅|烧烤|烤肉/.test(q)) return '火锅 烧烤';
  if (/小吃|快餐/.test(q)) return '快餐 小吃';
  if (/餐厅|吃|美食|饭店/.test(q)) return '餐厅 美食';
  return (
    q
      .replace(/帮我|找一家|附近|适合现在去吃的|现在去吃|想吃|推荐|一家|哪里|可以|有没有/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || '餐厅'
  );
}

export default function RestaurantFinder({
  items,
  city = '北京',
  keyword = '找餐厅',
  onBack,
  onSelect,
}: RestaurantFinderProps) {
  const [activeTab, setActiveTab] = useState('全部');
  const [activeChip, setActiveChip] = useState('智能排序');
  const [searchValue, setSearchValue] = useState('');
  const [committedKeyword, setCommittedKeyword] = useState('');
  const [remoteItems, setRemoteItems] = useState<RestaurantCardData[]>([]);
  const [inputTips, setInputTips] = useState<InputTip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const normalizedQuery = normalizeRestaurantQuery(committedKeyword || keyword);
  const hasInitialItems = items.length > 0;
  const hasSearchedRef = useRef(false);
  const [quickOrderItem, setQuickOrderItem] = useState<RestaurantCardData | null>(null);

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

      const term = normalizedQuery || '美食 餐厅 咖啡';
      setIsLoading(true);
      setError(null);
      try {
        const pois = await searchSmartNearby(term, city, 5000);
        if (!alive) return;
        if (!pois.length) {
          if (alive) setRemoteItems([]);
          return;
        }

        const sliced = pois.slice(0, 20);
        const imageMap = await batchFetchPOIImages(
          sliced.map(poi => ({ name: poi.name, city, poiId: poi.id }))
        );
        const next: RestaurantCardData[] = sliced.map((poi, index) => {
          const rating = parseFloat(poi.rating);
          const cost = Number(poi.cost);
          return {
            id: `amap_restaurant_${index}`,
            name: poi.name,
            rating: isNaN(rating) ? 0 : rating,
            avgPrice: cost > 0 ? cost : 35,
            distance: poi.distance
              ? `${Math.max(0.2, Number(poi.distance) / 1000).toFixed(1)}km`
              : `${(0.4 + index * 0.3).toFixed(1)}km`,
            category: (poi.type ?? '').split(';')[0] || '美食餐厅',
            tags: [(poi.type ?? '').split(';')[1] || '美食', '高德推荐'],
            address: poi.address || `${city}热门商圈`,
            image: imageMap.get(poi.name) || getFeedImage(`${poi.name} 餐厅 ${poi.type}`, `amap_restaurant_${index}`),
            poiId: poi.id,
            openTime: poi.openTime,
            businessArea: poi.businessArea,
            phone: poi.phone !== '暂无' ? poi.phone : undefined,
          };
        });
        if (alive) setRemoteItems(next);
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
  }, [city, keyword, normalizedQuery, hasInitialItems, retryCount]);

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
    let next = effectiveItems.filter((item) => {
      const tabMatched = activeTab === '全部' || resolveCategoryTab(item) === activeTab;
      const searchMatched =
        !query ||
        `${item.name} ${item.category} ${item.tags.join(' ')} ${item.address}`
          .toLowerCase()
          .includes(query);
      return tabMatched && searchMatched;
    });

    if (activeChip === '筛选') {
      next = next.filter(
        (item) =>
          item.rating >= RATING_MIN_THRESHOLD &&
          (item.avgPrice > 0 ? item.avgPrice <= PRICE_MAX_THRESHOLD : true)
      );
    } else if (activeChip === '附近') {
      next = [...next].sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    } else if (activeChip === '全部美食') {
      // 不做额外过滤
    } else if (activeChip === '智能排序') {
      next = [...next].sort((a, b) => {
        const scoreA = (a.rating || 0) * 20 - (a.avgPrice || 0) / 30;
        const scoreB = (b.rating || 0) * 20 - (b.avgPrice || 0) / 30;
        return scoreB - scoreA;
      });
    }

    if (next.length === 0) return effectiveItems;
    return next;
  }, [effectiveItems, activeTab, normalizedQuery, activeChip]);

  const spotlight = useMemo(() => filteredItems.slice(0, MAX_SPOTLIGHT_ITEMS), [filteredItems]);
  const listItems = useMemo(() => filteredItems.slice(0, MAX_RESULTS_DISPLAY), [filteredItems]);

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
              <h1 className="text-[22px] font-bold text-[var(--app-ink)]">美食</h1>
              <div className="flex items-center gap-0.5 text-[var(--app-text)]">
                <MapPin className="w-4 h-4" />
                <span className="text-[13px] font-bold">{city}</span>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
          <button
            onClick={() => openMapSearch(`${city} ${normalizedQuery || '餐厅'}`)}
            className="app-pill w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
            aria-label="在地图搜索"
          >
            <Navigation className="w-5 h-5 text-[var(--app-ink)]" />
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
            placeholder="搜餐厅、菜系、商圈"
            className="w-full h-14 rounded-full border-2 border-[#ffd56a] bg-white pl-12 pr-24 text-[15px] font-medium text-[var(--app-ink)] outline-none shadow-[0_8px_18px_rgba(20,24,33,0.04)]"
          />
          <button
            onClick={() => {
              hasSearchedRef.current = true;
              setCommittedKeyword(searchValue);
              setInputTips([]);
            }}
            className="app-btn-primary absolute right-1.5 top-1.5 h-11 rounded-full px-6 text-[15px] font-bold active:scale-95"
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
          <div className="rounded-[24px] border border-[var(--peach-strong)] bg-[linear-gradient(135deg,rgba(255,247,251,0.96)_0%,rgba(255,241,225,0.82)_100%)] px-4 py-4 shadow-[0_8px_24px_rgba(31,41,55,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--peach-soft)] text-[var(--peach-ink)] flex items-center justify-center text-[13px] font-bold">
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
                附近优先
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--app-text)] border border-[var(--app-border)]">
                评分靠前
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {spotlight.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="rounded-2xl bg-white p-2.5 border border-[var(--peach-strong)] shadow-[0_6px_18px_rgba(233,114,91,0.06)] text-left active:scale-[0.98] transition-transform"
                >
                  <div className="relative h-[86px] rounded-xl overflow-hidden mb-2.5 bg-[var(--app-card-soft)]">
                    <GradientImg
                      src={item.image}
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-[13px] font-bold text-[var(--app-ink)] line-clamp-1">
                    {item.name}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--app-text-soft)] font-bold">
                    {item.distance}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {item.avgPrice > 0 && (
                      <span className="text-[13px] font-bold text-[var(--peach-ink)] shrink-0">
                        ¥{item.avgPrice}/人
                      </span>
                    )}
                    {item.rating > 0 && (
                      <span className="text-[13px] text-[var(--app-text-soft)] shrink-0">
                        {item.rating.toFixed(1)}分
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 px-4">
          <div className="flex items-center gap-7 overflow-x-auto scrollbar-none pb-3">
            {categoryTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative whitespace-nowrap text-[15px] font-bold ${activeTab === tab ? 'text-[var(--app-ink)]' : 'text-[var(--app-text)]'}`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute -bottom-2 left-0 right-0 h-1 rounded-full bg-[var(--peach-ink)]" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none pb-2">
            {filterChips.map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  setActiveChip(chip);
                  if (chip === '全部美食') {
                    setActiveTab('全部');
                  }
                }}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-2xl border px-4 py-2 text-[13px] font-bold ${
                  activeChip === chip
                    ? 'border-[var(--peach-strong)] bg-[var(--peach-soft)] text-[var(--peach-ink)]'
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
            {listItems.map((item) => {
              const cardData: ResultCardData = {
                id: item.id,
                name: item.name,
                image: item.image,
                rating: item.rating,
                avgPrice: item.avgPrice,
                distance: item.distance,
                address: item.address,
                category: item.category,
                tags: item.tags,
              };
              return (
                <ResultCard
                  key={item.id}
                  type="restaurant"
                  data={cardData}
                  onSelect={() => onSelect(item)}
                  onQuickOrder={() => setQuickOrderItem(item)}
                />
              );
            })}
          </div>
        )}

        {!isLoading && !error && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Search className="w-10 h-10 text-[var(--app-text-soft)] mb-3" />
            <div className="text-[13px] font-bold text-[var(--app-text-soft)]">
              未找到符合条件的餐厅
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
        isOpen={!!quickOrderItem}
        onClose={() => setQuickOrderItem(null)}
        data={
          quickOrderItem
            ? {
                id: quickOrderItem.id,
                name: quickOrderItem.name,
                avgPrice: quickOrderItem.avgPrice,
                image: quickOrderItem.image,
              }
            : null
        }
        type="restaurant"
        onConfirm={(_data, _qty) => {
          setQuickOrderItem(null);
          onSelect(quickOrderItem!);
        }}
      />
    </div>
  );
}
