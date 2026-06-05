import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Heart,
  Map,
  MessageCircle,
  Share2,
  MapPin,
  ChevronLeft,
  SquarePen,
  X,
  Play,
  Image as ImageIcon,
  Video,
  Loader2,
  Check,
  ArrowUpRight,
  Compass,
  Sparkles,
  Layers,
  Trees,
  UtensilsCrossed,
  Coffee,
  ShoppingBag,
  Bed,
  Navigation,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { PersonProfile, Post } from '../../types';
import GradientImg from '../ui/GradientImg';
import { formatCount } from '../../services/utils';
import { shareText } from '../../services/clientActions';
import { getUserCity } from '../../services/ai';
import { getAvatarPath } from '../../utils/avatarUtils';
import {
  searchInputTips,
  searchSmartNearby,
  dataSource,
  getUserLocation,
} from '../../services/apiAdapter';
import { batchFetchPOIImages } from '../../services/poiImageService';
import type { InputTip } from '../../services/apiAdapter';
import { loadAmapScript as loadAmapScriptUnified } from '../../services/amapWeb';

interface AMapInstance {
  remove(target: unknown): void;
  add(target: unknown): void;
  setFitView(overlays?: unknown[], immediately?: boolean, padding?: number[]): void;
  resize(): void;
  destroy(): void;
  setCenter(lnglat: [number, number]): void;
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  setZoom(zoom: number): void;
  addControl(control: unknown): void;
  on?(event: string, callback: (...args: unknown[]) => void): void;
  off?(event: string, callback: (...args: unknown[]) => void): void;
}

interface AMapMarker {
  on(event: string, callback: (e: { lnglat: { lng: number; lat: number } }) => void): void;
  off?(event: string, callback: (...args: unknown[]) => void): void;
  setPosition(lnglat: [number, number]): void;
  getPosition(): { lng: number; lat: number };
}

interface AMapStatic {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AMapInstance;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
  Pixel: new (x: number, y: number) => { x: number; y: number };
  InfoWindow: new (options: Record<string, unknown>) => {
    open(map: AMapInstance, position: [number, number]): void;
    close(): void;
  };
  LabelMarker?: new (options: Record<string, unknown>) => AMapMarker;
  getConfig?: () => { appname?: string };
}

interface ExploreProps {
  onInspire?: (query: string) => void;
  onPostSelect?: (post: Post) => void;
  onBack?: () => void;
  posts: Post[];
  onCreatePost: (post: Omit<Post, 'id'>) => void;
  profiles: PersonProfile[];
}

type NearbyPlace = {
  id: string;
  name: string;
  address: string;
  distanceLabel: string;
  distanceMeters: number;
  tag: string;
  image: string;
  post: Post | null;
  lat: number;
  lng: number;
  category: PlaceCategory;
  poiId?: string;
};

type PlaceCategory = 'scenic' | 'food' | 'drink' | 'shopping' | 'accommodation';

const categoryConfig: Record<
  PlaceCategory,
  {
    label: string;
    icon: React.ReactNode;
    bgClass: string;
    textClass: string;
    borderClass: string;
    keywords: string[];
    amapTypes: string;
    markerColor: string;
    markerBgColor: string;
    markerIcon: string;
  }
> = {
  scenic: {
    label: '景点',
    icon: <Trees className="w-4 h-4" />,
    bgClass: 'bg-[var(--mint-soft)]',
    textClass: 'text-[var(--mint-ink)]',
    borderClass: 'border-[var(--mint-strong)]',
    keywords: ['公园', '景点', '景区', '博物馆', '纪念馆', '展览馆', '乐园'],
    amapTypes: '110000|120000|140000', // 风景名胜|公共设施|文化场馆
    markerColor: '#2aa27a',
    markerBgColor: '#dcf1e5',
    markerIcon:
      '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>',
  },
  food: {
    label: '美食',
    icon: <UtensilsCrossed className="w-4 h-4" />,
    bgClass: 'bg-[var(--peach-soft)]',
    textClass: 'text-[var(--peach-ink)]',
    borderClass: 'border-[var(--peach-strong)]',
    keywords: ['餐厅', '美食', '火锅', '烧烤', '川菜', '日料', '西餐'],
    amapTypes: '050000', // 餐饮
    markerColor: '#d98b4c',
    markerBgColor: '#fff1e1',
    markerIcon:
      '<path d="M2 12h20"/><path d="M6 12V6.5a4.5 4.5 0 0 1 9 0V12"/><path d="M6 12v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/>',
  },
  drink: {
    label: '饮品',
    icon: <Coffee className="w-4 h-4" />,
    bgClass: 'bg-[var(--brand-soft)]',
    textClass: 'text-[var(--brand-ink)]',
    borderClass: 'border-[#ffe2a3]',
    keywords: ['咖啡', '奶茶', '饮品', '茶馆', '甜品'],
    amapTypes: '050000|070000', // 餐饮|生活服务
    markerColor: '#e6a817',
    markerBgColor: '#fff8e6',
    markerIcon:
      '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 1v3"/><path d="M10 1v3"/><path d="M14 1v3"/>',
  },
  shopping: {
    label: '购物',
    icon: <ShoppingBag className="w-4 h-4" />,
    bgClass: 'bg-[var(--rose-soft)]',
    textClass: 'text-[var(--rose-ink)]',
    borderClass: 'border-[var(--rose-strong)]',
    keywords: ['商场', '购物', '购物中心', '超市', '步行街'],
    amapTypes: '060000', // 购物
    markerColor: '#c94b86',
    markerBgColor: '#ffe7f1',
    markerIcon:
      '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  },
  accommodation: {
    label: '住宿',
    icon: <Bed className="w-4 h-4" />,
    bgClass: 'bg-[var(--sky-soft)]',
    textClass: 'text-[var(--sky-ink)]',
    borderClass: 'border-[var(--sky-strong)]',
    keywords: ['酒店', '宾馆', '民宿', '客栈', '住宿'],
    amapTypes: '100000', // 住宿
    markerColor: '#6b7d98',
    markerBgColor: '#f2f5fb',
    markerIcon:
      '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
  },
};

type MapPoi = {
  name: string;
  address: string;
  distance: number;
  lat: number;
  lng: number;
  location: { lng: number; lat: number };
  category: PlaceCategory;
};

export default function Explore({
  onInspire,
  onPostSelect,
  onBack,
  posts,
  onCreatePost,
  profiles,
}: ExploreProps) {
  const [activeTab, setActiveTab] = useState('推荐');
  const [activeTag, setActiveTag] = useState('');
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [draftMediaType, setDraftMediaType] = useState<'image' | 'video'>('image');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftLocationQuery, setDraftLocationQuery] = useState('');
  const [draftTag, setDraftTag] = useState('宝藏小店');
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState('');
  const [uploadedPosterUrl, setUploadedPosterUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedVideoDuration, setUploadedVideoDuration] = useState('');
  const [locationOptions, setLocationOptions] = useState<Array<{ name: string; address: string }>>(
    []
  );
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | 'all'>('all');
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [nearbyCity, setNearbyCity] = useState('北京');
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showPlaceDetail, setShowPlaceDetail] = useState<NearbyPlace | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoadRetry, setMapLoadRetry] = useState(0);
  const [searchRadius, setSearchRadius] = useState<number>(2000); // 默认2km
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const amapInstanceRef = useRef<AMapInstance | null>(null);
  const amapMarkersRef = useRef<AMapMarker[]>([]);
  const amapUserMarkerRef = useRef<AMapMarker | null>(null);
  const amapInfoWindowRef = useRef<{
    open(map: AMapInstance, position: [number, number]): void;
    close(): void;
  } | null>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const moveEndHandlerRef = useRef<((...args: unknown[]) => void) | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const MARKER_THRESHOLD = 20;

  const distanceOptions = [
    { label: '1km', value: 1000 },
    { label: '2km', value: 2000 },
    { label: '3km', value: 3000 },
    { label: '5km', value: 5000 },
  ];

  const tags = ['全部', '周末特种兵', '宝藏小店', '户外露营', '看展达人', '美食探店'];

  const filteredItems = posts.filter((item) => {
    const tagMatched = activeTag === '' || activeTag === '全部' || item.tags.includes(activeTag);
    const query = searchText.trim();
    const searchMatched =
      !query ||
      `${item.title} ${item.content} ${item.location} ${item.tags.join(' ')}`.includes(query);
    return tagMatched && searchMatched;
  });

  const nearbyPosts = useMemo(() => posts.slice(0, 6), [posts]);

  useEffect(() => {
    let disposed = false;

    function classifyPOI(name: string, type?: string): PlaceCategory {
      const lowerName = name.toLowerCase();
      if (type) {
        const lowerType = type.toLowerCase();
        if (
          lowerType.includes('景点') ||
          lowerType.includes('公园') ||
          lowerType.includes('景区') ||
          lowerType.includes('博物馆')
        ) {
          return 'scenic';
        }
        if (
          lowerType.includes('餐饮') ||
          lowerType.includes('餐厅') ||
          lowerType.includes('美食')
        ) {
          return 'food';
        }
        if (lowerType.includes('购物') || lowerType.includes('商场')) {
          return 'shopping';
        }
        if (lowerType.includes('酒店') || lowerType.includes('住宿')) {
          return 'accommodation';
        }
        if (
          lowerType.includes('咖啡') ||
          lowerType.includes('饮品') ||
          lowerType.includes('茶馆')
        ) {
          return 'drink';
        }
      }
      for (const [category, config] of Object.entries(categoryConfig)) {
        if (config.keywords.some((keyword) => lowerName.includes(keyword.toLowerCase()))) {
          return category as PlaceCategory;
        }
      }
      return 'scenic';
    }

    // 计算两点间距离(米) - 经纬度坐标系(高德使用GCJ02)
    function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 6371000; // 地球半径 (米)
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    async function loadNearby() {
      setIsLoadingNearby(true);
      try {
        const city = await getUserCity();
        if (disposed) return;
        setNearbyCity(city);

        const categories: PlaceCategory[] = [
          'scenic',
          'food',
          'drink',
          'shopping',
          'accommodation',
        ];

        let allPois: Array<{
          name: string;
          address: string;
          distance: string;
          lat: number;
          lng: number;
          type?: string;
          poiId?: string;
          category: PlaceCategory;
        }> = [];

        if (dataSource.hasAmap) {
          const results: Awaited<ReturnType<typeof searchSmartNearby>>[] = [];
          for (const category of categories) {
            const keywords = categoryConfig[category].keywords.join(' ');
            const radius =
              category === 'accommodation' ? Math.min(searchRadius * 0.6, 1200) : searchRadius;
            const types = categoryConfig[category].amapTypes;
            const pois = await searchSmartNearby(keywords, city, radius, types);
            results.push(pois);
            if (categories.indexOf(category) < categories.length - 1) {
              await new Promise((r) => setTimeout(r, 300));
            }
          }

          results.forEach((pois, index) => {
            const category = categories[index];
            pois.forEach((poi) => {
              // 只保留有位置信息的POI
              if (!poi.location?.lat || !poi.location?.lng) return;

              allPois.push({
                name: poi.name,
                address: poi.address,
                distance: poi.distance || '0',
                lat: poi.location.lat,
                lng: poi.location.lng,
                type: poi.type,
                poiId: poi.id,
                category,
              });
            });
          });
        }

        if (disposed) return;

        const seen = new Set<string>();
        allPois = allPois.filter((p) => {
          const key = p.poiId || `${p.name}_${p.lat}_${p.lng}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // 二次距离验证：确保所有POI都在用户设定的搜索半径内！
        const userLat = userLocation?.lat || 39.9;
        const userLng = userLocation?.lng || 116.4;
        const validPois = allPois
          .map((poi) => {
            const dist = calculateDistance(userLat, userLng, poi.lat, poi.lng);
            return { ...poi, distance: String(Math.round(dist)) }; // 用计算的距离替换API返回的可能不可靠的距离！
          })
          .filter((poi) => {
            const dist = Number(poi.distance);
            // 根据分类使用动态半径：住宿使用较小的半径
            const maxRadius =
              poi.category === 'accommodation' ? Math.min(searchRadius * 0.6, 1200) : searchRadius;
            return dist <= maxRadius;
          });

        // 按名称和位置去重，避免跨分类的重复POI
        const seenPois = new Set<string>();
        const uniqueAllPois = validPois.filter((poi) => {
          const key = `${poi.name}_${Math.round(poi.lat * 1000)}_${Math.round(poi.lng * 1000)}`;
          if (seenPois.has(key)) return false;
          seenPois.add(key);
          return true;
        });

        // 平均分配每个分类的POI，确保每个类别都有展示
        const POIS_PER_CATEGORY = 5; // 增加每个分类的POI数量
        const selectedPois: typeof allPois = [];

        // 按分类平均抽取POI
        for (let i = 0; i < categories.length; i++) {
          const categoryPois = uniqueAllPois.filter((p) => p.category === categories[i]);
          // 先按距离排序，再取前几个
          const sortedPois = [...categoryPois].sort(
            (a, b) => Number(a.distance) - Number(b.distance)
          );
          const selected = sortedPois.slice(0, POIS_PER_CATEGORY);
          selected.forEach((poi) => selectedPois.push(poi));
        }

        // 尝试将POI与相关帖子匹配
        const matchPostToPoi = (poiName: string, poiCategory: PlaceCategory): Post | null => {
          // 首先尝试按类别匹配
          const categoryPosts = nearbyPosts.filter((post) =>
            post.tags.some((tag) =>
              categoryConfig[poiCategory].keywords.some(
                (k) =>
                  tag.toLowerCase().includes(k.toLowerCase()) ||
                  post.title.toLowerCase().includes(k.toLowerCase()) ||
                  post.content.toLowerCase().includes(k.toLowerCase())
              )
            )
          );

          // 如果有匹配的帖子，返回第一个
          if (categoryPosts.length > 0) {
            return categoryPosts[Math.floor(Math.random() * categoryPosts.length)];
          }

          // 如果没有匹配的，返回一个随机的帖子
          if (nearbyPosts.length > 0) {
            return nearbyPosts[Math.floor(Math.random() * nearbyPosts.length)];
          }

          return posts[0] || null;
        };

        const sourceItems =
          selectedPois.length > 0
            ? selectedPois
            : nearbyPosts
                .slice(0, 5)
                .flatMap((post, index) => {
                  const categoriesList: PlaceCategory[] = [
                    'scenic',
                    'food',
                    'drink',
                    'shopping',
                    'accommodation',
                  ];
                  // 每个post只对应一个分类，避免重复
                  const cat = categoriesList[index % categoriesList.length];
                  return [
                    {
                      name: (post.location ?? '').split('·')[1] || post.title,
                      address: (post.location ?? '').split('·')[0] || city,
                      distance: String(200 + index * 150),
                      lat: (userLocation?.lat || 39.9) + (Math.random() - 0.5) * 0.02,
                      lng: (userLocation?.lng || 116.4) + (Math.random() - 0.5) * 0.02,
                      category: cat,
                    },
                  ];
                })
                .slice(0, 25);

        const nextPlaces: NearbyPlace[] = sourceItems.map((item, index) => {
          const matchedPost = matchPostToPoi(item.name, item.category);
          const distanceMeters = Number(item.distance || 0);
          return {
            id: `nearby_${index}`,
            name: item.name,
            address: item.address,
            distanceLabel: `${Math.max(0.2, distanceMeters / 1000).toFixed(1)}km`,
            distanceMeters,
            tag: categoryConfig[item.category].label,
            image: matchedPost?.mediaPoster || matchedPost?.image || 'gradient:blue-purple',
            post: matchedPost,
            lat: item.lat,
            lng: item.lng,
            category: item.category,
            poiId: 'poiId' in item ? (item as { poiId?: string }).poiId : undefined,
          };
        });

        setNearbyPlaces(nextPlaces);

        const imageItems = nextPlaces.map((p) => ({
          name: p.name,
          city,
          location: { lng: p.lng, lat: p.lat },
          poiId: p.poiId,
        }));

        if (imageItems.length > 0) {
          try {
            const imageMap = await batchFetchPOIImages(imageItems);
            if (!disposed && imageMap.size > 0) {
              setNearbyPlaces((prev) =>
                prev.map((p) => {
                  const realUrl = imageMap.get(p.name);
                  return realUrl ? { ...p, image: realUrl } : p;
                })
              );
            }
          } catch {}
        }
      } finally {
        if (!disposed) setIsLoadingNearby(false);
      }
    }

    if (activeTab === '附近') {
      void loadNearby();
    }

    return () => {
      disposed = true;
    };
  }, [activeTab, nearbyPosts, posts, searchRadius]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const heroPost = nearbyPlaces[0]?.post || posts[0] || null;

  const handleLike = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setLikedPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleLocationSearch = async () => {
    const keyword = draftLocationQuery.trim();
    if (!keyword) {
      setLocationOptions([]);
      return;
    }
    setIsSearchingLocation(true);
    try {
      const city = await getUserCity();
      const tips = dataSource.hasAmap ? await searchInputTips(keyword, city) : [];
      if (!mountedRef.current) return;
      const nextOptions = tips.map((tip) => ({
        name: tip.name,
        address: tip.address ? `${tip.district}·${tip.address}` : tip.district,
      }));
      setLocationOptions(nextOptions);
    } finally {
      if (mountedRef.current) setIsSearchingLocation(false);
    }
  };

  const handleLocationInputChange = (value: string) => {
    setDraftLocationQuery(value);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      handleLocationSearch();
    }, 300);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setUploadedMediaUrl(objectUrl);
    setUploadedPosterUrl(objectUrl);
    setUploadedFileName(file.name);
    setDraftMediaType('image');
    setUploadedVideoDuration('');
  };

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setUploadedMediaUrl(objectUrl);
    setUploadedPosterUrl(objectUrl);
    setUploadedFileName(file.name);
    setDraftMediaType('video');
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = objectUrl;
    video.onloadedmetadata = () => {
      const seconds = Math.round(video.duration || 0);
      const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
      const ss = String(seconds % 60).padStart(2, '0');
      setUploadedVideoDuration(`${mm}:${ss}`);
    };
  };

  const handleCreatePost = () => {
    if (!draftTitle.trim() || !draftContent.trim() || !uploadedMediaUrl) return;
    const locationToUse = draftLocation.trim() || `${nearbyCity}·任意位置`;
    const newPost: Post = {
      id: Date.now(),
      title: draftTitle.trim(),
      content: draftContent.trim(),
      location: locationToUse,
      tags: [draftTag],
      userName: profiles[0]?.name || '小明',
      hotCount: 0,
      comments: [],
      image: draftMediaType === 'image' ? uploadedMediaUrl : uploadedPosterUrl || uploadedMediaUrl,
      mediaType: draftMediaType,
      mediaUrl: draftMediaType === 'video' ? uploadedMediaUrl : undefined,
      mediaPoster: draftMediaType === 'video' ? uploadedPosterUrl || uploadedMediaUrl : undefined,
      mediaDuration: draftMediaType === 'video' ? uploadedVideoDuration || '00:10' : undefined,
    };
    setMyPosts((prev) => [newPost, ...prev]);
    onCreatePost(newPost);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setDraftTitle('');
    setDraftContent('');
    setDraftLocation('');
    setDraftLocationQuery('');
    setLocationOptions([]);
    setDraftTag('宝藏小店');
    setDraftMediaType('image');
    setUploadedMediaUrl('');
    setUploadedPosterUrl('');
    setUploadedFileName('');
    setUploadedVideoDuration('');
    setShowComposer(false);
    setActiveTab('我的');
  };

  const getUserCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          console.warn('[Explore] 获取用户位置失败，使用默认位置');
          // 北京默认位置
          setUserLocation({
            lat: 39.9042,
            lng: 116.4074,
          });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setUserLocation({
        lat: 39.9042,
        lng: 116.4074,
      });
    }
  };

  const centerToUserLocation = () => {
    if (amapInstanceRef.current && userLocation) {
      amapInstanceRef.current.setCenter([userLocation.lng, userLocation.lat]);
      amapInstanceRef.current.setZoom(15);
    } else {
      getUserCurrentLocation();
    }
  };

  useEffect(() => {
    if (activeTab === '附近' && nearbyPlaces.length > 0) {
      const pois: MapPoi[] = nearbyPlaces.map((p) => ({
        name: p.name,
        address: p.address,
        distance: p.distanceMeters,
        lat: p.lat,
        lng: p.lng,
        location: { lng: p.lng, lat: p.lat },
        category: p.category,
      }));

      const filteredPlaces =
        selectedCategory === 'all'
          ? pois
          : pois.filter((p: MapPoi) => p.category === selectedCategory);

      const initMapAsync = async () => {
        if (!mapContainerRef.current) return;
        setMapError(null);

        try {
          const AMap = (await loadAmapScriptUnified([
            'AMap.Scale',
          ])) as unknown as AMapStatic | null;
          if (!mapContainerRef.current) return;

          if (!AMap) {
            setMapError('地图加载失败，请检查网络后重试');
            return;
          }

          if (!amapInstanceRef.current) {
            amapInstanceRef.current = new AMap.Map(mapContainerRef.current, {
              viewMode: '3D',
              zoom: 14,
              pitch: 0,
              rotation: 0,
            });

            setTimeout(() => {
              if (amapInstanceRef.current) {
                amapInstanceRef.current.resize();
              }
            }, 100);

            let moveEndTimer: ReturnType<typeof setTimeout> | null = null;
            const handleMoveEnd = () => {
              if (moveEndTimer) clearTimeout(moveEndTimer);
              moveEndTimer = setTimeout(() => {
                if (amapInstanceRef.current) {
                  amapInstanceRef.current.resize();
                  setRefreshKey((prev) => prev + 1);
                }
              }, 1000);
            };
            amapInstanceRef.current.on?.('moveend', handleMoveEnd);
            moveEndHandlerRef.current = handleMoveEnd;
          }

          const map = amapInstanceRef.current;

          amapMarkersRef.current.forEach((marker) => {
            try {
              map.remove(marker);
            } catch (e) {}
          });
          amapMarkersRef.current = [];

          if (amapUserMarkerRef.current) {
            try {
              map.remove(amapUserMarkerRef.current);
            } catch (e) {}
            amapUserMarkerRef.current = null;
          }

          if (userLocation) {
            const userMarker = new AMap.Marker({
              position: [userLocation.lng, userLocation.lat],
              offset: new AMap.Pixel(-14, -14),
              content: `<div style="width:28px;height:28px;border-radius:999px;background:#1e88e5;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(30,136,229,0.15), 0 4px 12px rgba(0,0,0,0.15)"><div style="width:10px;height:10px;border-radius:999px;background:white;box-shadow:0 2px 4px rgba(0,0,0,0.1)"></div></div>`,
            });
            try {
              map.add(userMarker);
              amapUserMarkerRef.current = userMarker;
            } catch (e) {}
          }

          const useLabelMarker = filteredPlaces.length > MARKER_THRESHOLD;

          filteredPlaces.forEach((poi: MapPoi, index: number) => {
            const lat = poi.location?.lat || poi.lat;
            const lng = poi.location?.lng || poi.lng;
            if (!lat || !lng) return;

            const isSelected = selectedPlaceId === `nearby_${index}`;
            const category = poi.category;
            const config = categoryConfig[category];

            const markerContent = `
              <div style="position: relative; width: ${isSelected ? '32px' : '26px'}; height: ${isSelected ? '32px' : '26px'}; border-radius: 999px; background: ${isSelected ? config.markerColor : 'white'}; display: flex; align-items: center; justify-content: center; box-shadow: ${isSelected ? '0 4px 16px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.08)'}; transition: all 0.2s ease;">
                <div style="width: ${isSelected ? '18px' : '14px'}; height: ${isSelected ? '18px' : '14px'}; border-radius: 999px; background: ${config.markerBgColor}; display: flex; align-items: center; justify-content: center;">
                  <svg width="${isSelected ? '11' : '9'}" height="${isSelected ? '11' : '9'}" viewBox="0 0 24 24" fill="none" stroke="${config.markerColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${config.markerIcon}"/></svg>
                </div>
              </div>
            `;

            let marker: AMapMarker;
            if (useLabelMarker && AMap.LabelMarker) {
              marker = new AMap.LabelMarker({
                position: [lng, lat],
                icon: {
                  size: new AMap.Pixel(isSelected ? 32 : 26, isSelected ? 32 : 26),
                  image: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${isSelected ? 32 : 26}" height="${isSelected ? 32 : 26}" viewBox="0 0 26 26"><circle cx="13" cy="13" r="13" fill="${isSelected ? config.markerColor : 'white'}" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"/><circle cx="13" cy="13" r="7" fill="${config.markerBgColor}"/></svg>`)}`,
                  imageSize: new AMap.Pixel(isSelected ? 32 : 26, isSelected ? 32 : 26),
                },
              } as Record<string, unknown>) as AMapMarker;
            } else {
              marker = new AMap.Marker({
                position: [lng, lat],
                offset: new AMap.Pixel(isSelected ? -16 : -13, isSelected ? -16 : -13),
                content: markerContent,
              });
            }

            marker.on('click', () => {
              const place = nearbyPlaces.find(
                (p) => Math.abs(p.lat - lat) < 0.001 && Math.abs(p.lng - lng) < 0.001
              );
              if (place) {
                setShowPlaceDetail(place);
                setSelectedPlaceId(place.id);
                try {
                  if (amapInfoWindowRef.current) {
                    amapInfoWindowRef.current.close();
                  }
                  const infoWindow = new AMap.InfoWindow({
                    isCustom: false,
                    content: `<div style="padding:8px 12px;max-width:220px;">
                      <div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:4px;">${place.name}</div>
                      <div style="font-size:12px;color:#666;margin-bottom:2px;">${place.address || ''}</div>
                      <div style="font-size:11px;color:#999;">${place.distanceLabel}</div>
                    </div>`,
                    offset: new AMap.Pixel(0, -30),
                    anchor: 'bottom-center',
                  });
                  infoWindow.open(map, [lng, lat]);
                  amapInfoWindowRef.current = infoWindow;
                } catch (_) {}
              }
            });

            try {
              map.add(marker);
              amapMarkersRef.current.push(marker);
            } catch (e) {}
          });

          const allMarkers = [...amapMarkersRef.current];
          if (amapUserMarkerRef.current) allMarkers.push(amapUserMarkerRef.current);

          if (allMarkers.length > 0) {
            setTimeout(() => {
              if (amapInstanceRef.current) {
                try {
                  amapInstanceRef.current.setFitView(allMarkers, false, [50, 50, 50, 50]);
                } catch (e) {}
              }
            }, 150);
          }
        } catch (err) {
          console.error('[Explore] initMap error:', err);
          setMapError('地图加载失败，请检查网络后重试');
        }
      };

      void initMapAsync();
    }

    return () => {
      if (amapInstanceRef.current && activeTab !== '附近') {
        if (moveEndHandlerRef.current) {
          try {
            amapInstanceRef.current.off?.('moveend', moveEndHandlerRef.current);
          } catch (_) {}
          moveEndHandlerRef.current = null;
        }
        if (amapInfoWindowRef.current) {
          try {
            amapInfoWindowRef.current.close();
          } catch (_) {}
          amapInfoWindowRef.current = null;
        }
        amapInstanceRef.current.destroy();
        amapInstanceRef.current = null;
        amapMarkersRef.current = [];
        amapUserMarkerRef.current = null;
      }
    };
  }, [activeTab, nearbyPlaces, selectedCategory, selectedPlaceId, userLocation, refreshKey]);

  // 当进入附近页面时，获取用户位置
  useEffect(() => {
    if (activeTab === '附近' && !userLocation) {
      getUserCurrentLocation();
    }
  }, [activeTab]);

  return (
    <div className="flex w-full h-screen flex-col bg-transparent relative">
      {/* Header */}
      <div className="px-5 pt-14 pb-3 bg-[#fbfcff]/94 backdrop-blur-xl sticky top-0 z-20 shadow-[0_6px_18px_rgba(20,24,33,0.04)] border-b border-[var(--app-border)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="app-pill w-10 h-10 rounded-full flex items-center justify-center text-[var(--app-ink)] active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="text-[20px] font-bold tracking-tight text-[#141821]">发现</div>
          </div>
          <button
            onClick={() => setShowComposer(true)}
            className="app-pill w-10 h-10 rounded-full flex items-center justify-center text-[var(--app-ink)] active:scale-95"
            aria-label="发布内容"
          >
            <SquarePen className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-center gap-8 pt-1">
          {['关注', '推荐', '附近', '我的'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative pb-2 text-[18px] transition-all active:scale-95 ${
                activeTab === tab
                  ? 'text-[#141821] font-bold'
                  : 'text-[var(--app-text-soft)] font-bold'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="tabLine"
                  className="absolute bottom-0 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-[var(--brand)]"
                />
              )}
            </button>
          ))}
        </div>

        <div className="relative group mt-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--app-text-soft)] group-focus-within:text-[var(--brand-ink)] transition-colors stroke-[2.5]" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索路线、景点、美食..."
            className="w-full bg-[var(--app-card-soft)] focus:bg-white border border-transparent focus:border-[#ffe09d] rounded-full py-3.5 pl-12 pr-4 text-[13px] focus:outline-none transition-all shadow-inner focus:shadow-[0_4px_16px_rgba(255,200,58,0.12)] text-[var(--app-ink)] placeholder-gray-400 font-medium"
          />
        </div>

        {/* Tags */}
        {activeTab === '推荐' && (
          <div className="flex gap-3 overflow-x-auto mt-4 pb-2 scrollbar-none pr-5 -mx-5 px-5">
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag === activeTag ? '' : tag)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
                  tag === activeTag
                    ? 'bg-[var(--brand)] text-[var(--brand-ink)] shadow-[0_2px_8px_rgba(255,200,58,0.36)]'
                    : 'bg-white/90 border border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-card-soft)] cursor-pointer'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={`flex-1 overflow-y-auto px-4 pt-4 pb-8 relative z-10 flex flex-col ${activeTab === '附近' ? 'pb-safe' : ''}`}
      >
        {/* Feed: 推荐 */}
        {activeTab === '推荐' && (
          <div className="columns-2 gap-3 space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onPostSelect && onPostSelect(item)}
                className="bg-white rounded-[24px] overflow-hidden shadow-[0_10px_26px_rgba(20,24,33,0.06)] break-inside-avoid relative group active:scale-[0.98] transition-all hover:shadow-[0_16px_36px_rgba(20,24,33,0.08)] cursor-pointer pb-3 border border-[var(--app-border)]"
              >
                <div className="relative">
                  <GradientImg
                    src={item.mediaPoster || item.image}
                    alt={item.title}
                    className="w-full h-auto object-cover min-h-[160px]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  {item.mediaType === 'video' && (
                    <>
                      <div className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
                        {item.mediaDuration || '视频'}
                      </div>
                      <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-sm">
                        <Play className="ml-0.5 h-5 w-5 fill-current text-[var(--app-ink)]" />
                      </div>
                    </>
                  )}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-white/90" />
                    <span className="text-[11px] text-white/90 font-bold tracking-wider">
                      {item.location}
                    </span>
                  </div>
                </div>
                <div className="p-3.5 pt-4">
                  <h3 className="font-bold text-[var(--app-ink)] text-[13px] leading-[1.4] tracking-tight mb-3 line-clamp-2">
                    {item.title}
                  </h3>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2 pr-2">
                      <div className="w-[26px] h-[26px] rounded-xl bg-white p-0.5 flex-shrink-0 border border-[var(--app-border)] shadow-sm">
                        <div className="w-full h-full rounded-[8px] overflow-hidden">
                          <img
                            src={getAvatarPath({ name: item.userName || '用户' })}
                            alt="avatar"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] text-[var(--app-text)] font-bold truncate max-w-[60px]">
                        {item.userName}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleLike(e, item.id)}
                      className="flex items-center text-[var(--app-text-soft)] flex-shrink-0 group/btn cursor-pointer active:scale-95 transition-transform"
                    >
                      <Heart
                        className={`w-[14px] h-[14px] mr-1 transition-transform group-hover/btn:scale-110 ${likedPosts.has(item.id) ? 'fill-[var(--rose-ink)] text-[var(--rose-ink)]' : 'text-[var(--app-text-soft)]'}`}
                        strokeWidth={likedPosts.has(item.id) ? 0 : 2.5}
                      />
                      <span
                        className={`text-[11px] font-bold ${likedPosts.has(item.id) ? 'text-[var(--rose-ink)]' : ''}`}
                      >
                        {formatCount(item.hotCount + (likedPosts.has(item.id) ? 1 : 0))}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feed: 关注 */}
        {activeTab === '关注' && (
          <div className="space-y-6 max-w-full">
            {posts.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-[24px] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.02)] border border-[var(--app-border)]"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-[46px] h-[46px] rounded-2xl bg-white p-1 border border-[var(--app-border)] shadow-sm">
                      <div className="w-full h-full rounded-xl overflow-hidden">
                        <img
                          src={getAvatarPath({ name: item.userName || '用户' })}
                          alt="u"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="font-bold text-[var(--app-ink)] text-[15px] block">
                        {item.userName}
                      </span>
                      <span className="text-[11px] text-[var(--app-text-soft)] font-medium">
                        刚刚发布
                      </span>
                    </div>
                  </div>
                  <div className="w-8 h-8" />
                </div>
                <p className="text-[15px] text-[var(--app-ink)] mb-3 whitespace-pre-line line-clamp-3 leading-relaxed">
                  <span className="font-bold mr-2">{item.title}</span>
                  {item.content}
                </p>
                <div
                  onClick={() => onPostSelect && onPostSelect(item)}
                  className="w-full aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer relative"
                >
                  <GradientImg
                    src={item.mediaPoster || item.image}
                    className="w-full h-full object-cover"
                  />
                  {item.mediaType === 'video' && (
                    <>
                      <div className="absolute inset-0 bg-black/15" />
                      <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/92">
                        <Play className="ml-0.5 h-5 w-5 fill-current text-[var(--app-ink)]" />
                      </div>
                      <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
                        {item.mediaDuration || '视频'}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={(e) => handleLike(e, item.id)}
                      className="flex items-center gap-1.5 text-[var(--app-text)] hover:text-[var(--rose-ink)] transition-colors cursor-pointer active:scale-95"
                    >
                      <Heart
                        className={`w-6 h-6 ${likedPosts.has(item.id) ? 'fill-[var(--rose-ink)] text-[var(--rose-ink)]' : ''}`}
                        strokeWidth={likedPosts.has(item.id) ? 0 : 2}
                      />
                      <span className="text-[13px] font-bold">
                        {formatCount(item.hotCount + (likedPosts.has(item.id) ? 1 : 0))}
                      </span>
                    </button>
                    <button
                      onClick={() => onPostSelect && onPostSelect(item)}
                      className="flex items-center gap-1.5 text-[var(--app-text)] hover:text-[var(--sky-ink)] transition-colors cursor-pointer active:scale-95"
                    >
                      <MessageCircle className="w-6 h-6 text-[var(--app-text)]" />
                      <span className="text-[13px] font-bold">{item.comments.length}</span>
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      shareText({ title: item.title, text: `${item.location}\n${item.content}` })
                    }
                    className="text-[var(--app-text-soft)] hover:text-[var(--app-text)] cursor-pointer active:scale-95 transition-transform"
                  >
                    <Share2 className="w-5 h-5 text-[var(--app-text)]" />
                  </button>
                </div>
              </div>
            ))}
            <div className="py-4 text-center text-[var(--app-text-soft)] text-[13px] font-medium">
              没有更多动态了～
            </div>
          </div>
        )}

        {/* Feed: 附近 */}
        {activeTab === '附近' && (
          <div className="space-y-4">
            <div className="relative min-h-[520px] rounded-[30px] border border-[var(--app-border)] shadow-[0_14px_34px_rgba(20,24,33,0.06)] overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/88 px-3 py-1.5 text-[11px] font-bold text-[var(--sky-ink)] border border-[var(--sky-strong)]">
                      <Map className="w-3.5 h-3.5" />
                      {dataSource.hasAmap ? '附近地图' : '附近灵感地图'}
                    </div>
                    <div className="mt-3 text-[20px] font-bold tracking-tight text-[#141821]">
                      {nearbyCity}附近值得去
                    </div>
                    <div className="mt-1 text-[13px] font-bold text-[var(--app-text-soft)]">
                      {isLoadingNearby
                        ? '正在查找附近地点...'
                        : `已整理 ${nearbyPlaces.length || 0} 个适合打卡的地点`}
                    </div>
                  </div>
                </div>

                {/* 距离选择器 */}
                <div className="mt-4 flex items-center gap-2 overflow-x-auto scrollbar-none">
                  <span className="shrink-0 text-[13px] font-bold text-[var(--app-text)]">
                    搜索范围：
                  </span>
                  <div className="flex gap-1.5">
                    {distanceOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSearchRadius(option.value);
                        }}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 ${
                          searchRadius === option.value
                            ? 'bg-[var(--sky-strong)] text-[var(--sky-ink)] shadow-[0_6px_16px_rgba(59,130,246,0.25)]'
                            : 'bg-[var(--app-card-soft)] text-[var(--app-text)] hover:bg-gray-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 分类标签栏 */}
                <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none pb-1">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`group flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-white/96 px-3 pr-3 text-left active:scale-[0.98] ${
                      selectedCategory === 'all'
                        ? 'border-[#ffe2a3] bg-[var(--brand-soft)] text-[var(--brand-ink)] shadow-[0_10px_24px_rgba(255,200,58,0.12)]'
                        : 'border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-card-soft)]'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${selectedCategory === 'all' ? 'bg-[var(--brand-soft)] text-[var(--brand-ink)]' : 'bg-[var(--app-card-soft)] text-[var(--app-text)]'}`}
                    >
                      <Layers className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-semibold leading-none">全部</span>
                  </button>
                  {(
                    Object.entries(categoryConfig) as [
                      PlaceCategory,
                      (typeof categoryConfig)[PlaceCategory],
                    ][]
                  ).map(([category, config]) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`group flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-white/96 px-3 pr-3 text-left active:scale-[0.98] ${config.borderClass} ${selectedCategory === category ? 'shadow-[0_10px_24px_rgba(0,0,0,0.08)]' : ''}`}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${config.bgClass} ${config.textClass}`}
                      >
                        {config.icon}
                      </span>
                      <span
                        className={`text-[11px] font-semibold leading-none ${config.textClass}`}
                      >
                        {config.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 pb-4 relative">
                <div
                  ref={mapContainerRef}
                  className="w-full h-[400px] rounded-[24px] overflow-hidden"
                />
                {mapError && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/95 rounded-[24px]">
                    <div className="text-[13px] font-bold text-[var(--app-ink)] mb-3">
                      {mapError}
                    </div>
                    <button
                      onClick={() => {
                        setMapLoadRetry((prev) => prev + 1);
                        setMapError(null);
                        const pois: MapPoi[] = nearbyPlaces.map((p) => ({
                          name: p.name,
                          address: p.address,
                          distance: p.distanceMeters,
                          lat: p.lat,
                          lng: p.lng,
                          location: { lng: p.lng, lat: p.lat },
                          category: p.category,
                        }));
                        setMapError(null);
                        amapInstanceRef.current?.destroy();
                        amapInstanceRef.current = null;
                      }}
                      className="app-pill px-4 py-2 bg-[var(--brand)] text-[var(--brand-ink)] font-bold text-[13px] rounded-full active:scale-95"
                    >
                      重新加载
                    </button>
                  </div>
                )}
                {/* 定位按钮 */}
                <button
                  onClick={centerToUserLocation}
                  className="absolute bottom-7 right-7 app-pill w-12 h-12 rounded-full flex items-center justify-center bg-white/96 border border-[var(--app-border)] shadow-[0_10px_24px_rgba(0,0,0,0.1)] active:scale-[0.96] transition-all"
                >
                  <div className="flex items-center justify-center">
                    <Navigation className="w-6 h-6 text-[var(--sky-ink)]" />
                  </div>
                </button>
              </div>

              {isLoadingNearby && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <div className="rounded-[24px] bg-white/92 px-5 py-4 shadow-[0_12px_30px_rgba(20,24,33,0.08)] border border-[var(--app-border)] flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--sky-ink)]" />
                    <span className="text-[13px] font-bold text-[var(--app-ink)]">
                      正在加载附近地点
                    </span>
                  </div>
                </div>
              )}

              {/* Map markers rendered via useEffect initMap */}
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-bold text-[#141821]">附近精选</div>
                  <div className="mt-1 text-[13px] font-bold text-[var(--app-text-soft)]">
                    从地图到笔记详情，一路看完整灵感
                  </div>
                </div>
                <button
                  onClick={() =>
                    heroPost &&
                    onInspire?.(
                      `参考这篇附近灵感，为我规划一条能串联这些地点的路线：${heroPost.title} ${heroPost.content}`
                    )
                  }
                  className="app-pill px-3 py-2 rounded-full flex items-center gap-1.5 active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--brand-ink)]" />
                  <span className="text-[11px] font-bold text-[var(--brand-ink)]">
                    生成附近路线
                  </span>
                </button>
              </div>

              <div className="grid gap-3">
                {(() => {
                  let filteredPlaces = nearbyPlaces;
                  if (selectedCategory !== 'all') {
                    filteredPlaces = nearbyPlaces.filter((p) => p.category === selectedCategory);
                  }
                  return (
                    filteredPlaces.length > 0
                      ? filteredPlaces
                      : nearbyPosts.map((post, index) => ({
                          id: `fallback_${index}`,
                          name: (post.location ?? '').split('·')[1] || post.title,
                          address: (post.location ?? '').split('·')[0] || nearbyCity,
                          distanceLabel: `${(0.4 + index * 0.3).toFixed(1)}km`,
                          distanceMeters: Math.round((0.4 + index * 0.3) * 1000),
                          tag: post.tags[0] || '附近可去',
                          image: post.mediaPoster || post.image,
                          post,
                          lat: 0,
                          lng: 0,
                          category: 'scenic' as PlaceCategory,
                        }))
                  )
                    .slice(0, 25)
                    .map((place) => (
                      <button
                        key={place.id}
                        onClick={() => {
                          setSelectedPlaceId(place.id);
                          setShowPlaceDetail(place);
                        }}
                        className={`app-card rounded-[24px] p-3.5 text-left active:scale-[0.98] transition-all w-full overflow-hidden ${selectedPlaceId === place.id ? 'border-2 border-[var(--brand)] shadow-[0_8px_24px_rgba(255,200,58,0.2)]' : ''}`}
                      >
                        <div className="flex gap-3">
                          <div className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[24px]">
                            <GradientImg src={place.image} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div
                                  className="truncate text-[15px] font-bold text-[var(--app-ink)]"
                                  title={place.name}
                                >
                                  {place.name}
                                </div>
                                <div
                                  className="mt-1 truncate text-[11px] font-bold text-[var(--app-text-soft)]"
                                  title={place.address}
                                >
                                  {place.address}
                                </div>
                              </div>
                              <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--app-card-soft)] text-[var(--sky-ink)]">
                                <ArrowUpRight className="w-4 h-4" />
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 overflow-hidden">
                              <span className="shrink-0 rounded-full bg-[var(--sky-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--sky-ink)]">
                                {place.distanceLabel}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${categoryConfig[place.category].bgClass} ${categoryConfig[place.category].textClass}`}
                              >
                                {categoryConfig[place.category].label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Feed: 我的 */}
        {activeTab === '我的' && (
          <div className="space-y-4">
            <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-[var(--app-border)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-[52px] w-[52px] rounded-2xl bg-white/90 p-1 shadow-sm shrink-0">
                  <div className="w-full h-full rounded-xl bg-white flex items-center justify-center overflow-hidden border border-[var(--app-border)]">
                    <img
                      src={profiles[0] ? getAvatarPath(profiles[0]) : '/mascot/smile.png'}
                      alt={profiles[0]?.name || '用户头像'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-[var(--app-ink)]">
                    {profiles[0]?.name || '小明'}
                  </div>
                  <div className="text-[13px] font-bold text-[var(--app-text)]">
                    已发布 {myPosts.length} 条动态
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowComposer(true)}
                className="w-full bg-[var(--brand)] text-[var(--brand-ink)] py-3 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-[0_4px_12px_rgba(255,200,58,0.25)]"
              >
                <SquarePen className="w-4 h-4" />
                发布新动态
              </button>
            </div>

            {myPosts.length === 0 ? (
              <div className="bg-white rounded-[24px] p-8 text-center border border-[var(--app-border)]">
                <div className="w-16 h-16 rounded-full bg-[var(--app-card-soft)] flex items-center justify-center mx-auto mb-3">
                  <ImageIcon className="w-8 h-8 text-[var(--app-text-soft)]" />
                </div>
                <div className="text-[15px] font-bold text-[var(--app-ink)] mb-1">
                  还没有发布动态
                </div>
                <div className="text-[13px] font-medium text-[var(--app-text)]">
                  快去发布你的第一条动态吧！
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {myPosts.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-[24px] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-[var(--app-border)]"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-[36px] w-[36px] rounded-[12px] bg-white p-0.5 shrink-0 shadow-sm">
                        <div className="w-full h-full rounded-xl bg-white flex items-center justify-center overflow-hidden border border-[var(--app-border)]">
                          <img
                            src={profiles[0] ? getAvatarPath(profiles[0]) : '/mascot/smile.png'}
                            alt={item.userName || '用户头像'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[var(--app-ink)] truncate">
                          {item.userName}
                        </div>
                        <div className="text-[11px] font-medium text-[var(--app-text-soft)]">
                          刚刚发布
                        </div>
                      </div>
                    </div>
                    <div
                      onClick={() => onPostSelect && onPostSelect(item)}
                      className="w-full aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer relative mb-3"
                    >
                      <GradientImg
                        src={item.mediaPoster || item.image}
                        className="w-full h-full object-cover"
                      />
                      {item.mediaType === 'video' && (
                        <>
                          <div className="absolute inset-0 bg-black/15" />
                          <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/92">
                            <Play className="ml-0.5 h-5 w-5 fill-current text-[var(--app-ink)]" />
                          </div>
                          <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
                            {item.mediaDuration || '视频'}
                          </div>
                        </>
                      )}
                    </div>
                    <h3 className="font-bold text-[var(--app-ink)] text-[15px] leading-[1.4] tracking-tight mb-2">
                      {item.title}
                    </h3>
                    <p className="text-[13px] text-[var(--app-text)] leading-relaxed line-clamp-2 mb-2">
                      {item.content}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--sky-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--sky-ink)]">
                        <MapPin className="w-3 h-3" />
                        {item.location}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--brand-ink)]">
                        {item.tags[0]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showComposer && (
        <div
          className="absolute inset-0 z-40 bg-black/50 flex items-end"
          onClick={() => setShowComposer(false)}
        >
          <div
            className="w-full rounded-t-[28px] bg-white px-5 pt-5 pb-8 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => setShowComposer(false)}
                className="text-[15px] font-bold text-[var(--app-text)]"
              >
                取消
              </button>
              <div className="text-[18px] font-bold text-[var(--app-ink)]">发布动态</div>
              <button
                onClick={handleCreatePost}
                disabled={!draftTitle.trim() || !uploadedMediaUrl}
                className={`px-5 py-2.5 rounded-[24px] text-[15px] font-bold transition-all ${
                  draftTitle.trim() && uploadedMediaUrl
                    ? 'bg-[#FF2442] text-white active:scale-[0.96]'
                    : 'bg-[var(--app-card-soft)] text-[var(--app-text-soft)]'
                }`}
              >
                发布
              </button>
            </div>
            <div className="space-y-5">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoUpload}
              />
              {/* 媒体预览区域 */}
              <button
                onClick={() => {
                  if (draftMediaType === 'image') imageInputRef.current?.click();
                  else videoInputRef.current?.click();
                }}
                className="relative w-full overflow-hidden rounded-[24px] border border-[var(--app-border)] bg-[var(--app-card-soft)] active:scale-[0.99]"
              >
                {uploadedMediaUrl ? (
                  <>
                    <GradientImg
                      src={uploadedPosterUrl || uploadedMediaUrl}
                      alt="upload preview"
                      className="h-[240px] w-full object-cover"
                    />
                    {draftMediaType === 'video' && (
                      <>
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg">
                          <Play className="ml-1 h-6 w-6 fill-current text-[var(--app-ink)]" />
                        </div>
                        <div className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-[13px] font-bold text-white">
                          {uploadedVideoDuration || '视频'}
                        </div>
                      </>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedMediaUrl('');
                        setUploadedPosterUrl('');
                      }}
                      className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-[240px] w-full flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--app-card-soft)] flex items-center justify-center">
                      {draftMediaType === 'image' ? (
                        <ImageIcon className="w-7 h-7 text-[var(--app-text-soft)]" />
                      ) : (
                        <Video className="w-7 h-7 text-[var(--app-text-soft)]" />
                      )}
                    </div>
                    <div className="text-[13px] font-bold text-[var(--app-text)]">
                      点击上传{draftMediaType === 'image' ? '图片' : '视频'}
                    </div>
                  </div>
                )}
              </button>

              {/* 图片/视频切换 */}
              <div className="flex gap-2">
                {[
                  { key: 'image' as const, label: '图片', icon: <ImageIcon className="w-4 h-4" /> },
                  { key: 'video' as const, label: '视频', icon: <Video className="w-4 h-4" /> },
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={() => {
                      setDraftMediaType(option.key);
                      if (!uploadedMediaUrl && option.key === 'image')
                        imageInputRef.current?.click();
                      if (!uploadedMediaUrl && option.key === 'video')
                        videoInputRef.current?.click();
                    }}
                    className={`flex-1 rounded-2xl border px-4 py-3 text-[13px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] ${
                      draftMediaType === option.key
                        ? 'border-gray-900 bg-[var(--app-ink)] text-white'
                        : 'border-[var(--app-border)] bg-[var(--app-card-soft)] text-[var(--app-text)]'
                    }`}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                ))}
              </div>

              {/* 标题 */}
              <div className="space-y-2">
                <div className="text-[13px] font-bold text-[var(--app-text-soft)]">标题</div>
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="写个好标题，更容易被看到"
                  className="w-full rounded-[0px] px-0 py-2 text-[18px] font-bold text-[var(--app-ink)] outline-none placeholder:text-[var(--app-text-soft)] border-b border-[var(--app-border)]"
                />
              </div>

              {/* 内容 */}
              <div className="space-y-2">
                <div className="text-[13px] font-bold text-[var(--app-text-soft)]">正文</div>
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="分享你的精彩体验"
                  rows={4}
                  className="w-full rounded-[0px] px-0 py-2 text-[15px] font-medium text-[var(--app-ink)] outline-none resize-none placeholder:text-[var(--app-text-soft)]"
                />
              </div>
              {/* 地点 */}
              <div className="space-y-3">
                <div className="text-[13px] font-bold text-[var(--app-text-soft)]">地点</div>
                <div className="flex gap-2">
                  <input
                    value={draftLocationQuery}
                    onChange={(e) => handleLocationInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                    placeholder="添加地点"
                    className="flex-1 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card-soft)] px-4 py-3 text-[13px] font-medium text-[var(--app-ink)] outline-none placeholder:text-[var(--app-text-soft)]"
                  />
                  <button
                    onClick={() => void handleLocationSearch()}
                    className="rounded-2xl bg-[var(--app-ink)] px-4 text-[13px] font-bold text-white active:scale-[0.98] flex items-center justify-center min-w-[72px]"
                  >
                    {isSearchingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜索'}
                  </button>
                </div>
                <button
                  onClick={async () => {
                    setIsSearchingLocation(true);
                    try {
                      const [loc, city] = await Promise.all([getUserLocation(), getUserCity()]);
                      const currentLocation = `${city}·当前位置`;
                      setDraftLocation(currentLocation);
                      setDraftLocationQuery('当前位置');
                      setLocationOptions([]);
                    } finally {
                      setIsSearchingLocation(false);
                    }
                  }}
                  className="w-full rounded-2xl bg-[var(--app-card-soft)] border border-[var(--app-border)] px-4 py-3 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Compass className="w-4 h-4 text-[var(--app-text)]" />
                  <span className="text-[13px] font-bold text-[var(--app-text)]">使用我的位置</span>
                </button>
                {draftLocation && (
                  <div className="rounded-2xl bg-[#F2FFF5] px-4 py-3 text-[13px] font-bold text-[#22C55E] flex items-center gap-2 border border-[#DCFCE7]">
                    <Check className="w-4 h-4" />
                    {draftLocation}
                  </div>
                )}
                {locationOptions.length > 0 && (
                  <div className="space-y-1 rounded-[24px] border border-[var(--app-border)] bg-[var(--app-card-soft)] p-2 max-h-[240px] overflow-y-auto">
                    {locationOptions.map((option) => {
                      const label = `${option.address}·${option.name}`;
                      return (
                        <button
                          key={label}
                          onClick={() => {
                            setDraftLocation(label);
                            setLocationOptions([]);
                            setDraftLocationQuery(option.name);
                          }}
                          className="w-full rounded-2xl bg-white px-4 py-3 text-left active:scale-[0.99] hover:bg-[var(--app-card-soft)] transition-colors border border-transparent"
                        >
                          <div className="text-[13px] font-bold text-[var(--app-ink)]">
                            {option.name}
                          </div>
                          <div className="mt-1 text-[13px] font-medium text-[var(--app-text-soft)]">
                            {option.address}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 标签 */}
              <div className="space-y-3">
                <div className="text-[13px] font-bold text-[var(--app-text-soft)]">话题</div>
                <div className="flex flex-wrap gap-2">
                  {tags.slice(1).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setDraftTag(tag)}
                      className={`px-4 py-2 rounded-full text-[13px] font-bold transition-all ${
                        draftTag === tag
                          ? 'bg-[var(--app-ink)] text-white'
                          : 'bg-[var(--app-card-soft)] text-[var(--app-ink)] hover:bg-gray-200'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 地点详情弹窗 */}
      <AnimatePresence>
        {showPlaceDetail && (
          <div
            className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px] flex items-end"
            onClick={() => setShowPlaceDetail(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full rounded-t-[28px] bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3" />

              <div className="p-5">
                <div className="h-[220px] w-full rounded-[24px] overflow-hidden">
                  <GradientImg src={showPlaceDetail.image} className="h-full w-full object-cover" />
                </div>

                <div className="mt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[22px] font-bold text-[var(--app-ink)] tracking-tight truncate">
                        {showPlaceDetail.name}
                      </h2>
                      <p className="mt-1 text-[13px] font-bold text-[var(--app-text-soft)] flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {showPlaceDetail.address}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPlaceDetail(null)}
                      className="app-pill w-9 h-9 rounded-full flex items-center justify-center text-[var(--app-text)] hover:bg-[var(--app-card-soft)] active:scale-95"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--sky-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--sky-ink)]">
                      {showPlaceDetail.distanceLabel}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${categoryConfig[showPlaceDetail.category].bgClass} ${categoryConfig[showPlaceDetail.category].textClass}`}
                    >
                      {categoryConfig[showPlaceDetail.category].label}
                    </span>
                  </div>

                  {showPlaceDetail.post && (
                    <div className="mt-5">
                      <div className="text-[13px] font-bold text-[var(--app-text)] mb-2">
                        相关笔记
                      </div>
                      <div className="bg-[var(--app-card-soft)] rounded-[24px] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden">
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(showPlaceDetail.post.userName || '用户')}&background=random`}
                              alt="avatar"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="text-[13px] font-bold text-[var(--app-ink)]">
                            {showPlaceDetail.post.userName}
                          </span>
                        </div>
                        <p className="text-[13px] text-[var(--app-ink)] leading-relaxed">
                          <span className="font-bold">{showPlaceDetail.post.title} </span>
                          {showPlaceDetail.post.content}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => {
                        setShowPlaceDetail(null);
                        onInspire?.(
                          `我对 ${showPlaceDetail.name} 很感兴趣，帮我规划一条包含这个地点的路线`
                        );
                      }}
                      className="flex-1 bg-[var(--brand)] text-[var(--brand-ink)] py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-[0_4px_12px_rgba(255,200,58,0.3)]"
                    >
                      <Sparkles className="w-4.5 h-4.5" />
                      生成路线
                    </button>
                    <button
                      onClick={() => {
                        if (showPlaceDetail.post && onPostSelect) {
                          setShowPlaceDetail(null);
                          onPostSelect(showPlaceDetail.post);
                        }
                      }}
                      disabled={!showPlaceDetail.post}
                      className="flex-1 bg-[var(--app-ink)] text-white py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      查看详情
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
