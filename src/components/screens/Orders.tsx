import { useState, useRef } from 'react';
import {
  ChevronRight,
  Search,
  Sparkles,
  Camera,
  BookOpen,
  Clock,
  Share2,
  ChevronLeft,
  Inbox,
  Loader2,
} from 'lucide-react';
import type { Plan } from '../../services/ai';
import type { PlannerTaskState } from '../../types';
import type { ExecutionRunRecord } from '../../types';
import GradientImg from '../ui/GradientImg';
import TripOrderCard, { groupOrdersByTrip } from '../ui/TripOrderCard';
import type { TripOrderGroup } from '../ui/TripOrderCard';
import OrderDetailPanel from '../ui/OrderDetailPanel';
import {
  getPlannerTaskMeta,
  getPlannerTaskProgressText,
  normalizePlannerTaskStatus,
} from '../../utils/plannerTask';
import { shareText } from '../../services/clientActions';
import EmptyState from '../ui/EmptyState';
import { useOrders } from '../../hooks/useOrders';
import { useAppStore } from '../../store/appStore';

interface OrdersProps {
  savedPlans?: Plan[];
  plannerTaskStates?: PlannerTaskState[];
  onViewDetails?: (plan: Plan) => void;
  onPlanAgain?: (plan: Plan) => void;
  onAdjustPlan?: (plan: Plan) => void;
  onRecord?: (plan: Plan) => void;
  onViewStory?: (plan: Plan) => void;
  onBack?: () => void;
}

function getPlanTimeRange(plan: Plan): string {
  if (!plan.activities || plan.activities.length === 0) return plan.date || '全天';
  const first = plan.activities[0]?.timeLine || '';
  const last = plan.activities[plan.activities.length - 1]?.timeLine || '';
  const startTime = first.split('-')[0]?.trim() || '14:00';
  const endTime = last.split('-')[1]?.trim() || '20:00';
  const datePrefix = plan.date ? `${plan.date} ` : '';
  return `${datePrefix}${startTime} - ${endTime}`;
}

type ViewMode = 'plans' | 'orders';

const ORDER_TABS = ['全部', '待支付', '进行中', '已完成', '退款'] as const;
type OrderTab = (typeof ORDER_TABS)[number];

function getExecutionRunLabel(run?: ExecutionRunRecord | null): string {
  if (!run) return '';
  if (run.status === 'completed') return `${run.successCount}/${run.total} 已执行`;
  if (run.status === 'partial_failed') return `${run.successCount} 成功 · ${run.failCount} 失败`;
  if (run.status === 'running') return `${run.pendingCount} 项处理中`;
  if (run.status === 'cancelled') return '执行已取消';
  return '待执行';
}

function parseInitialViewMode(): ViewMode {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'orders') return 'orders';
    if (tab === 'plans') return 'plans';
  } catch {}
  return 'plans';
}

function parseInitialPlanTab(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const planTab = params.get('planTab');
    if (planTab && ['全部', '待处理', '待出发', '进行中', '已完成'].includes(planTab)) {
      return planTab;
    }
  } catch {}
  return '全部';
}

function parseInitialPlanId(): string | undefined {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('detail') || undefined;
  } catch {
    return undefined;
  }
}

export default function Orders({
  savedPlans = [],
  plannerTaskStates = [],
  onViewDetails,
  onPlanAgain,
  onAdjustPlan,
  onRecord,
  onViewStory,
  onBack,
}: OrdersProps) {
  const executionRuns = useAppStore((state) => state.executionRuns);
  const [activeTab, setActiveTab] = useState(parseInitialPlanTab);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const plansTabs = ['全部', '待处理', '待出发', '进行中', '已完成'];

  const [viewMode, setViewMode] = useState<ViewMode>(parseInitialViewMode);
  const [orderTab, setOrderTab] = useState<OrderTab>('全部');
  const [selectedTripGroup, setSelectedTripGroup] = useState<TripOrderGroup | null>(null);
  const {
    orders: orderData,
    loading: orderLoading,
    error: orderError,
    actionLoading,
    fetchOrders,
    handleCancelOrder,
    handleRefundOrder,
    handleDeleteOrder,
  } = useOrders();

  const tripGroups = groupOrdersByTrip(
    orderData.filter((o) => {
      if (orderTab === '全部') return true;
      switch (orderTab) {
        case '待支付':
          return o.status === 'pending';
        case '进行中':
          return o.status === 'paid' || o.status === 'in_progress';
        case '已完成':
          return o.status === 'completed';
        case '退款':
          return o.status === 'refunding' || o.status === 'refunded';
        default:
          return true;
      }
    })
  );

  const initialPlanId = parseInitialPlanId();
  const autoSelectedRef = useRef(false);
  if (initialPlanId && !autoSelectedRef.current && !orderLoading && tripGroups.length > 0) {
    const targetGroup = tripGroups.find((g) => g.planId === initialPlanId);
    if (targetGroup) {
      autoSelectedRef.current = true;
      setSelectedTripGroup(targetGroup);
    }
  }

  const safeSavedPlans = Array.isArray(savedPlans) ? savedPlans : [];
  const dynamicPlans = safeSavedPlans.map((p, index) => {
    const taskState = plannerTaskStates.find((item) => item.planId === p.id) || null;
    const executionRun = executionRuns.find((item) => item.planId === p.id) || null;
    const lifecycle = normalizePlannerTaskStatus(taskState?.status);
    const taskMeta = getPlannerTaskMeta(taskState?.status);

    const activityNames =
      p.activities
        ?.filter((act) => act.type !== 'travel')
        ?.slice(0, 3)
        ?.map((act) => act.title) || [];
    const fallbackText = getPlannerTaskProgressText(taskState, p.activities.length);

    return {
      id: p.id || `dyn_${index}`,
      title: p.title,
      lifecycle,
      status: taskMeta.label,
      statusPillClassName: taskMeta.pillClassName,
      activityNames,
      fallbackText,
      date: getPlanTimeRange(p),
      image: p.activities[0]?.imageUrl || 'gradient:indigo-blue',
      days: p.durationTags || '精选安排',
      executionRun,
      executionRunLabel: getExecutionRunLabel(executionRun),
      rawPlan: p,
    };
  });

  const filteredPlans = dynamicPlans.filter((p) => {
    if (!p.lifecycle) return false;
    const tabMatched =
      activeTab === '全部'
        ? true
        : activeTab === '待处理'
          ? p.lifecycle === 'planned' || p.lifecycle === 'selected'
          : activeTab === '待出发'
            ? p.lifecycle === 'booked'
            : activeTab === '进行中'
              ? p.lifecycle === 'executed'
              : activeTab === '已完成'
                ? p.lifecycle === 'completed'
                : true;

    const searchMatched =
      !searchValue.trim() ||
      `${p.title} ${p.rawPlan?.summary || ''} ${p.rawPlan?.activities?.map((item) => item.title).join(' ') || ''}`
        .toLowerCase()
        .includes(searchValue.trim().toLowerCase());

    return tabMatched && searchMatched;
  });

  return (
    <div
      className="flex w-full h-full flex-col bg-transparent relative overflow-hidden"
      onClick={() => setShowMenu(null)}
    >
      {!selectedTripGroup && (
        <div className="px-5 pt-14 pb-4 sticky top-0 z-20 flex flex-col gap-4 bg-[#fbfcff]/88 backdrop-blur-xl">
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="app-pill w-10 h-10 flex items-center justify-center rounded-full text-[var(--app-ink)] transition-transform active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                </button>
              )}
              <h1 className="font-bold text-[#141821] text-[20px] tracking-tight">
                {viewMode === 'plans' ? '我的行程' : '我的订单'}
              </h1>
            </div>
            {viewMode === 'plans' && (
              <button
                onClick={() => {
                  setIsSearchOpen((prev) => !prev);
                  if (isSearchOpen) setSearchValue('');
                }}
                className="app-pill w-10 h-10 flex items-center justify-center rounded-full text-[var(--app-ink)] transition-transform active:scale-95"
              >
                <Search className="w-[18px] h-[18px] stroke-[2.5]" />
              </button>
            )}
          </div>

          <div className="flex rounded-2xl bg-[var(--app-card-soft)] p-1">
            <button
              onClick={() => {
                setViewMode('plans');
                setActiveTab('全部');
              }}
              className={`flex-1 py-2 rounded-[12px] text-[13px] font-bold transition-all ${
                viewMode === 'plans'
                  ? 'bg-white text-[var(--app-ink)] shadow-sm'
                  : 'text-[var(--app-text)]'
              }`}
            >
              我的行程
            </button>
            <button
              onClick={() => {
                setViewMode('orders');
                setOrderTab('全部');
              }}
              className={`flex-1 py-2 rounded-[12px] text-[13px] font-bold transition-all ${
                viewMode === 'orders'
                  ? 'bg-white text-[var(--app-ink)] shadow-sm'
                  : 'text-[var(--app-text)]'
              }`}
            >
              我的订单
            </button>
          </div>

          {viewMode === 'plans' && isSearchOpen && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--app-text-soft)]" />
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="搜行程标题、地点"
                className="h-11 w-full rounded-2xl border border-[var(--app-border)] bg-white pl-11 pr-4 text-[13px] font-medium text-[var(--app-ink)] outline-none"
              />
            </div>
          )}

          {viewMode === 'plans' && (
            <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1 -mx-5 px-5">
              {plansTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-2xl whitespace-nowrap transition-all duration-300 border ${activeTab === tab ? 'app-btn-dark border-[#141821] text-white font-bold' : 'bg-white/86 border-transparent text-[var(--app-text)] font-bold hover:border-[var(--app-border)]'}`}
                >
                  <span className="text-[13px] tracking-wide">{tab}</span>
                </button>
              ))}
            </div>
          )}

          {viewMode === 'orders' && (
            <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1 -mx-5 px-5">
              {ORDER_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setOrderTab(tab)}
                  className={`px-4 py-2 rounded-2xl whitespace-nowrap transition-all duration-300 border ${orderTab === tab ? 'app-btn-dark border-[#141821] text-white font-bold' : 'bg-white/86 border-transparent text-[var(--app-text)] font-bold hover:border-[var(--app-border)]'}`}
                >
                  <span className="text-[13px] tracking-wide">{tab}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'plans' && (
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-24 space-y-5 relative z-10 bg-transparent">
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className="relative app-card rounded-[24px] p-2 flex flex-col group hover:shadow-[0_14px_36px_rgba(20,24,33,0.08)] transition-all"
            >
              <div className="flex gap-3 relative z-10 p-2 border-b border-gray-50 pb-4">
                <div className="relative w-[110px] h-[120px] rounded-[24px] overflow-hidden flex-shrink-0 shadow-inner">
                  <GradientImg
                    src={plan.image}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="flex-1 py-1 pr-1 flex flex-col">
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-[11px] font-semibold text-[var(--app-text)] app-card-soft px-2.5 py-1 rounded-xl tracking-wide flex items-center">
                      <Clock className="w-3 h-3 mr-1" strokeWidth={2.5} /> {plan.date}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${plan.statusPillClassName}`}
                    >
                      {plan.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-[18px] text-[var(--app-ink)] leading-[1.3] tracking-tight line-clamp-2 mt-1 mb-3">
                    {plan.title}
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {plan.executionRunLabel && (
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-[12px] border flex items-center ${
                          plan.executionRun?.status === 'partial_failed'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : plan.executionRun?.status === 'completed'
                              ? 'bg-[var(--success-soft)] text-green-700 border-green-200'
                              : plan.executionRun?.status === 'running'
                                ? 'bg-[var(--info-soft)] text-blue-700 border-blue-200'
                                : 'bg-[var(--app-card-soft)] text-[var(--app-text)] border-[var(--app-border)]'
                        }`}
                      >
                        <Sparkles
                          className={`w-3 h-3 mr-1 ${plan.executionRun?.status === 'partial_failed' ? 'text-orange-500' : plan.executionRun?.status === 'completed' ? 'text-green-500' : 'text-blue-500'}`}
                          strokeWidth={2.5}
                        />
                        {plan.executionRunLabel}
                      </span>
                    )}
                    {plan.activityNames.slice(0, 3).map((name, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-bold px-2.5 py-1.5 rounded-[12px] border bg-[#F7F8FA] text-[var(--app-text)] border-[var(--app-border)] flex items-center"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 py-1 px-3 relative z-10">
                <button
                  onClick={() => {
                    if (!plan.rawPlan) return;
                    onViewStory?.(plan.rawPlan);
                  }}
                  className="flex items-center gap-1 rounded-full bg-[var(--peach-soft)] px-2.5 py-1.5 transition-transform active:scale-95"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[var(--peach-ink)]" strokeWidth={2.5} />
                  <span className="text-[10px] font-bold text-[var(--peach-ink)]">回忆录</span>
                </button>
                <button
                  onClick={() => plan.rawPlan && onRecord?.(plan.rawPlan)}
                  className="flex items-center gap-1 rounded-full bg-[var(--mint-soft)] px-2.5 py-1.5 transition-transform active:scale-95"
                >
                  <Camera className="w-3.5 h-3.5 text-[var(--mint-ink)]" strokeWidth={2.5} />
                  <span className="text-[10px] font-bold text-[var(--mint-ink)]">拍照</span>
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard
                      .writeText(plan.title)
                      .then(() => shareText({ title: plan.title, text: plan.title }));
                  }}
                  className="flex items-center gap-1 rounded-full bg-[var(--cyan-soft)] px-2.5 py-1.5 transition-transform active:scale-95"
                >
                  <Share2 className="w-3.5 h-3.5 text-[var(--cyan-ink)]" strokeWidth={2.5} />
                  <span className="text-[10px] font-bold text-[var(--cyan-ink)]">分享</span>
                </button>
                <button
                  onClick={() => {
                    if (!plan.rawPlan) return;
                    onViewDetails?.(plan.rawPlan);
                  }}
                  className="ml-auto app-btn rounded-full px-4 py-2 flex items-center gap-1.5 font-bold text-[13px]"
                >
                  <span>详情</span>
                  <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))}
          {safeSavedPlans.length > 0 && (
            <div className="pt-6 pb-6 text-center flex flex-col items-center opacity-40">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mb-2"></div>
              <p className="text-[10px] text-[var(--app-text)] font-bold tracking-[0.1em]">
                THE END
              </p>
            </div>
          )}
        </div>
      )}

      {viewMode === 'orders' && selectedTripGroup && (
        <OrderDetailPanel
          group={selectedTripGroup}
          onBack={() => setSelectedTripGroup(null)}
          onCancel={handleCancelOrder}
          onRefund={handleRefundOrder}
          onDelete={handleDeleteOrder}
          actionLoading={actionLoading}
        />
      )}

      {viewMode === 'orders' && !selectedTripGroup && (
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-24 space-y-4 relative z-10 bg-transparent">
          {orderLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[var(--app-text-soft)] animate-spin" />
                <p className="text-[13px] text-[var(--app-text-soft)] font-medium">加载订单中...</p>
              </div>
            </div>
          )}

          {orderError && !orderLoading && (
            <div className="pt-20 pb-10 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-[24px] bg-[var(--danger-soft)] flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-[13px] text-[var(--app-text)] font-bold mb-1">加载失败</p>
              <p className="text-[13px] text-[var(--app-text-soft)] mb-4">{orderError}</p>
              <button
                onClick={fetchOrders}
                className="app-btn rounded-full px-6 py-2 text-sm font-medium"
              >
                重试
              </button>
            </div>
          )}

          {!orderLoading && !orderError && tripGroups.length === 0 && (
            <EmptyState
              mood="coffee"
              title="暂无订单"
              description="执行行程后，订单会自动生成"
              actionLabel="查看行程"
              onAction={() => setViewMode('plans')}
            />
          )}

          {!orderLoading &&
            !orderError &&
            tripGroups.map((group) => (
              <TripOrderCard key={group.planId} group={group} onClick={setSelectedTripGroup} />
            ))}

          {tripGroups.length > 0 && (
            <div className="pt-6 pb-6 text-center flex flex-col items-center opacity-40">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mb-2"></div>
              <p className="text-[10px] text-[var(--app-text)] font-bold tracking-[0.1em]">
                THE END
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
