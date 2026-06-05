import type { Plan, Activity } from '../../services/ai';
import type { RouteSegment, TravelMode } from '../../types';
import type { RouteSegmentResult } from '../../services/routePlanning';
import type { ExecutionPlan } from '../../services/tools';
import type { AgentStep } from '../../services/agent';

export type UIVariant = 'romantic' | 'family' | 'business' | 'compact' | 'default';

export interface UIStrategy {
  variant: UIVariant;
  emphasis: string[];
  warnings: { id: string; message: string; severity: 'info' | 'warning' | 'danger' }[];
  suggestedActions: { icon: string; label: string; prompt: string }[];
}

export interface ItineraryState {
  plan: Plan | null;
  selectedIds: Set<string>;
  bookedIds: Set<string>;
  travelMode: TravelMode;
  routeMap: {
    segments: RouteSegment[];
    totalDistance: number;
    totalDuration: number;
    totalCost: number;
  } | null;
  uiStrategy: UIStrategy | null;
  changeHistory: { action: string; timestamp: number; detail: string }[];
}

export type ItineraryAction =
  | { type: 'SET_PLAN'; plan: Plan }
  | { type: 'TOGGLE_SELECT'; activityId: string }
  | { type: 'SET_BOOKED'; activityId: string }
  | { type: 'SET_TRAVEL_MODE'; mode: TravelMode }
  | { type: 'SET_ROUTE_MAP'; routeMap: ItineraryState['routeMap'] }
  | { type: 'SET_UI_STRATEGY'; uiStrategy: UIStrategy }
  | { type: 'RECORD_CHANGE'; action: string; detail: string };

export type SurfacePhase = 'unmounted' | 'mounting' | 'mounted' | 'updating' | 'unmounting';

export interface SurfaceState {
  phase: SurfacePhase;
  lastUpdated: number;
}

export interface CatalogComponentDefinition {
  name: string;
  description: string;
  props: Record<
    string,
    { type: string; required: boolean; description: string; default?: unknown }
  >;
  variants?: UIVariant[];
}

export interface ActivityCardProps {
  activity: Activity;
  index: number;
  variant: UIVariant;
  isSelected: boolean;
  isBooked: boolean;
  isEmphasized: boolean;
  travelTime?: number;
  onActivityClick: (activity: Activity) => void;
  onToggleSelect?: (id: string) => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  draggable?: boolean;
}

export interface ActivityTimelineProps {
  activities: Activity[];
  uiVariant: UIVariant;
  selectedIds: Set<string>;
  bookedIds: Set<string>;
  emphasizedIds: string[];
  actualDurations: Map<number, number>;
  onActivityClick: (activity: Activity) => void;
  onToggleSelect: (id: string) => void;
  onUpdatePlan?: (activities: Activity[]) => void;
  onProceedPayment?: () => void;
  homeLocation?: { lat: number; lng: number; name: string };
  routeSegments?: RouteSegment[];
  travelMode?: TravelMode;
  onBookTaxi?: (
    from: { name: string; lat: number; lng: number },
    to: { name: string; lat: number; lng: number }
  ) => void;
}

export interface RouteOverviewCardProps {
  plan: Plan;
  travelMode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
}

export interface TransportInfoCardProps {
  travelMode: TravelMode;
  routeMap: ItineraryState['routeMap'];
  plan: Plan;
}

export interface RouteMapPoint {
  activityId?: string;
  /** 支持 Activity.id 作为 activityId 的别名 */
  id?: string;
  title: string;
  location: { lng: number; lat: number };
  isHome?: boolean;
}

export interface ItineraryVariant {
  id: string;
  label: string;
  source: 'budget' | 'llm' | 'manual';
  activities: Activity[];
  total?: number;
  perPerson?: number;
  strategy?: string;
  recommended?: boolean;
}

export interface RouteMapData {
  totalDistanceKm: string;
  totalDurationMin: number;
  totalCost?: number;
  city?: string;
  points: RouteMapPoint[];
  /** 统一使用 RouteSegment[] 内部格式 */
  segments?: RouteSegment[];
  isLoopRoute?: boolean;
  homeLocation?: { lat: number; lng: number; name: string };
  routeSource?: 'draft' | 'planned' | 'fallback';
}

export interface MapPanelProps {
  plan: Plan;
  travelMode: TravelMode;
  routeMap: RouteMapData | null;
  onActivityClick: (activity: Activity) => void;
}

export interface CopilotPanelProps {
  plan: Plan;
  travelMode: TravelMode;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePlan: (activities: Activity[]) => void;
}

export interface ExecutionPanelProps {
  isExecuting: boolean;
  executionPlan: ExecutionPlan | null;
  agentSteps: AgentStep[];
  agentResult: { success: boolean; summary: string } | null;
  onRetry: (stepIndex: number) => void;
  onClose: () => void;
}

export interface BottomActionBarProps {
  selectedCount: number;
  hasBooked: boolean;
  isExecuting: boolean;
  executeButtonLabel: string;
  travelMode: TravelMode;
  onOpenCopilot: () => void;
  onExecute: () => void;
  onProceedPayment: () => void;
}
