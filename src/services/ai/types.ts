export interface PlanningContext {
  profiles?: Array<{
    id: string;
    name: string;
    ageGroup?: string;
    relation?: string;
    mobility?: string;
    travelPreferences?: string[];
    dietaryPreferences?: string[];
    specialNeeds?: string[];
    budget?: string;
  }>;
  weather?: {
    city: string;
    temp: number;
    condition: string;
    advice: string;
  };
  collaboration?: {
    strategyLabel: string;
    consensus: string[];
    conflicts: string[];
    topAvoids?: string[];
    tieBreakerLabel?: string;
  };
  memberCount?: number;
  timePref?: string;
}

export interface ActivityTip {
  type: 'warning' | 'info' | 'booking';
  content: string;
}

export interface Activity {
  id: string;
  timeLine: string;
  title: string;
  type: 'activity' | 'food' | 'travel' | 'lodging';
  description: string;
  price: number;
  imageUrl?: string;
  distanceInfo?: string;
  lat?: number;
  lng?: number;
  poiPhotos?: string[];
  poiId?: string;
  rating?: number;
  address?: string;
  phone?: string;
  openTime?: string;
  businessArea?: string;
  tags: string[];
  reasoning?: string;
  teamFit?: string;
  tips?: ActivityTip[];
  bestVisitTime?: string;
  crowdLevel?: 'low' | 'medium' | 'high';
  alternatives?: Partial<Activity>[];
}

export interface Plan {
  id: string;
  title: string;
  durationTags: string;
  tags: string[];
  summary: string;
  activities: Activity[];
  totalPrice: number;
  memberCount?: number;
  strategy?: string;
  conflictResolution?: string;
  city?: string;
  date?: string;
  days?: Array<{
    dayIndex: number;
    date?: string;
    label: string;
    summary?: string;
    activities: Activity[];
    totalPrice?: number;
  }>;
  variantLabel?: string;
  variantTag?: string;
  lodging?: {
    needLodging: boolean;
    decisionReason: string;
    confidence: number;
    checkIn?: string;
    checkOut?: string;
    hotel?: {
      id: string;
      name: string;
      address?: string;
      price: number;
      rating?: number;
      confirmCode?: string;
      timeLine?: string;
      lat?: number;
      lng?: number;
    };
    alternatives?: Array<{
      id: string;
      name: string;
      price: number;
      rating?: number;
      address?: string;
    }>;
  };
  transport?: {
    toDestination?: {
      mode: string;
      duration: number;
      distance: number;
    };
    returnHome?: {
      mode: string;
      duration: number;
      distance: number;
    };
  };
  collaboration?: {
    strategyLabel: string;
    members: Array<{
      id: string;
      name: string;
      avatar?: string;
      relation: string;
      votes: string[];
      avoids?: string[];
    }>;
    consensus: string[];
    conflicts: string[];
    tieBreaker?: string;
  };
  executionReadiness?: {
    status: 'ready' | 'adjust' | 'risk';
    summary: string;
    checks: Array<{
      label: string;
      status: 'ok' | 'warning' | 'risk';
      detail: string;
    }>;
    fallbackOptions?: Array<{
      label: string;
      detail: string;
    }>;
  };
  uiStrategy?: {
    variant: 'romantic' | 'family' | 'business' | 'compact' | 'default';
    emphasis: string[];
    warnings: { id: string; message: string; severity: 'info' | 'warning' | 'danger' }[];
    suggestedActions: { icon: string; label: string; prompt: string }[];
  };
  shareSlug?: string;
  sourceQuery?: string;
  budgetOptions?: Array<{
    label: string; // "经济版" | "标准版" | "品质版"
    perPerson: number; // 人均价格
    total: number; // 总价
    strategy: string; // 策略描述
    activities?: Activity[]; // 该版本的活动列表（与主 activities 不同）
  }>;
}

export interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestedActions?: string[];
  modifiedActivities?: Activity[];
  interactiveComponent?: {
    type: 'BudgetSlider' | 'OptionVoting' | 'TimeAdjuster' | 'ActivityReplace' | 'ActivityAdd';
    props: Record<string, unknown>;
  };
}

export interface CompareResult {
  items: Array<{
    name: string;
    rating: string;
    priceRange: string;
    highlights: string[];
    drawbacks: string[];
    recommendation: string;
  }>;
  aiVerdict: string;
}

export interface AIStoryContent {
  title: string;
  paragraphs: string[];
  highlights: Array<{
    icon: string;
    label: string;
    value: string;
  }>;
}

export interface WeatherInfo {
  city: string;
  temp: number;
  tempRange: string;
  condition: string;
  humidity: number;
  advice: string;
  icon: string;
}

export interface OrderItem {
  name: string; // 商品名："奶茶"、"汉堡"
  quantity: number; // 数量：3
  specifications?: Array<{
    // 规格：去冰、少糖、大杯
    key: string; // "冰量"、"甜度"、"规格"
    value: string; // "去冰"、"少糖"、"大份"
  }>;
  exclusions?: string[]; // 排除项：不要香菜、不要辣
  remark?: string; // 备注：尽量快、多放辣
}

export interface MultiItemQuery {
  items: OrderItem[]; // 多个商品
  deliveryAddress?: string; // 配送地址
  urgency?: 'normal' | 'urgent' | 'very_urgent';
  budget?: [number, number];
}

export type ServiceIntent =
  | { type: 'weather'; city?: string }
  | { type: 'restaurant'; keywords?: string; city?: string }
  | { type: 'delivery'; keywords?: string; city?: string; orderItems?: MultiItemQuery }
  | { type: 'ticket'; keywords?: string; city?: string }
  | { type: 'coupon'; keywords?: string; city?: string }
  | { type: 'plan'; query: string }
  | { type: 'compare'; query: string }
  | { type: 'chat'; query: string };

export interface IntentRule {
  type: ServiceIntent['type'];
  keywords: Array<{ word: string; weight: number }>;
}

export interface DetectedIntent {
  type: ServiceIntent['type'];
  confidence: number;
  matchedWords: string[];
}

export interface WeatherImpactAssessment {
  level: 'none' | 'low' | 'medium' | 'high';
  risks: string[];
  recommendations: string[];
  autoAdjustments: Array<{
    activityId: string;
    action: 'replace' | 'reschedule' | 'add_indoor' | 'skip';
    reason: string;
    suggestion?: string;
  }>;
}
