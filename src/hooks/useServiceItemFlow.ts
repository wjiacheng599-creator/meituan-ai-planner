import { useState, useCallback, useRef } from 'react';
import type { ScreenId } from '../config/screens';
import type { Activity, CopilotMessage } from '../services/ai';
import type { Post } from '../types';
import type {
  RestaurantCardData,
  DeliveryCardData,
  TicketCardData,
  CouponCardData,
} from '../components/cards/ServiceCards';
import type { TaxiCardData } from '../components/cards/TaxiCard';

export function useServiceItemFlow(navigateTo: (newScreen: ScreenId) => void) {
  const [currentQuery, setCurrentQuery] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [restaurantFinderItems, setRestaurantFinderItems] = useState<RestaurantCardData[]>([]);
  const [restaurantFinderKeyword, setRestaurantFinderKeyword] = useState('');
  const [serviceFinderMode, setServiceFinderMode] = useState<'delivery' | 'ticket' | 'coupon'>(
    'delivery'
  );
  const [serviceFinderKeyword, setServiceFinderKeyword] = useState('');
  const [serviceFinderItems, setServiceFinderItems] = useState<
    DeliveryCardData[] | TicketCardData[] | CouponCardData[]
  >([]);
  const [finderCity, setFinderCity] = useState('北京');
  const [taxiFinderData, setTaxiFinderData] = useState<TaxiCardData | null>(null);
  const taxiBookingResultRef = useRef<{ data: TaxiCardData } | null>(null);
  const notifyTaxiBookingComplete = useCallback((data: TaxiCardData) => {
    taxiBookingResultRef.current = { data };
  }, []);
  const consumeTaxiBookingResult = useCallback(() => {
    const result = taxiBookingResultRef.current;
    taxiBookingResultRef.current = null;
    return result;
  }, []);
  const [homeStartNewTaskSignal, setHomeStartNewTaskSignal] = useState(0);
  const [copilotMessagesByPlan, setCopilotMessagesByPlan] = useState<
    Record<string, CopilotMessage[]>
  >({});
  const [storyTemplate, setStoryTemplate] = useState('diary');

  const openRestaurantDetail = useCallback(
    (item: RestaurantCardData) => {
      setSelectedActivity({
        id: item.id,
        title: item.name,
        type: 'food',
        description: `${item.category} · ${item.tags.join(' · ')}`,
        price: item.avgPrice,
        timeLine: item.openTime || '今日推荐',
        distanceInfo: item.address || item.distance,
        tags: item.tags,
        imageUrl: item.image,
        rating: item.rating,
        poiId: item.poiId,
        openTime: item.openTime,
        address: item.address,
        businessArea: item.businessArea,
        phone: item.phone,
      });
      navigateTo('detail');
    },
    [navigateTo]
  );

  const openServiceActivityDetail = useCallback(
    (item: TicketCardData) => {
      setSelectedActivity({
        id: item.id,
        title: item.name,
        type: 'activity',
        description: `${item.venue} · ${item.tags.join(' · ')}`,
        price: item.price,
        timeLine: `${item.date} ${item.time}`,
        distanceInfo: item.address || item.venue,
        tags: item.tags,
        imageUrl: item.image,
        poiId: item.poiId,
        rating: item.rating,
        openTime: item.openTime,
        address: item.address,
        businessArea: item.venue !== item.address ? item.venue : undefined,
      });
      navigateTo('detail');
    },
    [navigateTo]
  );

  const openServiceDeliveryDetail = useCallback(
    (item: DeliveryCardData) => {
      setSelectedActivity({
        id: item.id,
        title: item.name,
        type: 'food',
        description: `${item.category} · ${item.tags.join(' · ')}`,
        price: item.avgPrice,
        timeLine: item.deliveryTime,
        distanceInfo: item.address || `配送费¥${item.deliveryFee}`,
        tags: item.tags,
        imageUrl: item.image,
        rating: item.rating,
        poiId: item.poiId,
        address: item.address,
        businessArea: item.businessArea,
        phone: item.phone,
      });
      navigateTo('detail');
    },
    [navigateTo]
  );

  return {
    currentQuery,
    setCurrentQuery,
    selectedActivity,
    setSelectedActivity,
    selectedPost,
    setSelectedPost,
    restaurantFinderItems,
    setRestaurantFinderItems,
    restaurantFinderKeyword,
    setRestaurantFinderKeyword,
    serviceFinderMode,
    setServiceFinderMode,
    serviceFinderKeyword,
    setServiceFinderKeyword,
    serviceFinderItems,
    setServiceFinderItems,
    finderCity,
    setFinderCity,
    taxiFinderData,
    setTaxiFinderData,
    notifyTaxiBookingComplete,
    consumeTaxiBookingResult,
    homeStartNewTaskSignal,
    setHomeStartNewTaskSignal,
    copilotMessagesByPlan,
    setCopilotMessagesByPlan,
    storyTemplate,
    setStoryTemplate,
    openRestaurantDetail,
    openServiceActivityDetail,
    openServiceDeliveryDetail,
  };
}
