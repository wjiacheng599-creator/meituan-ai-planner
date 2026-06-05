import { apiUrl } from "../../services/apiBase";
import type { ReactNode } from 'react';
import { useState, useEffect, useRef, Fragment, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  Settings2,
  BookOpen,
  Shield,
  Trash2,
  X,
  Plus,
  CheckCircle2,
  ArrowRight,
  Compass,
  Route,
  Wallet,
  MapPin,
  Frown,
  Clock,
  ChevronRight,
} from 'lucide-react';

import type { PersonProfile, PlannerTaskState, TaskSession, Order } from '../../types';
import type { Plan } from '../../services/ai';
import { getPlannerTaskMeta, getPlannerTaskProgressText } from '../../utils/plannerTask';
import { getAvatarPath, getStyleTagsForAgeGroup } from '../../utils/avatarUtils';
import { resetAppStorage } from '../../services/storage';
import XiaoMeiAvatar from '../mascot/XiaoMeiAvatar';
import EmptyState from '../ui/EmptyState';
import { useOrders } from '../../hooks/useOrders';
import { groupOrdersByTrip } from '../ui/TripOrderCard';

interface ProfileProps {
  onViewMemories?: () => void;
  profiles: PersonProfile[];
  onUpdateProfiles: (profiles: PersonProfile[]) => void;
  onBack?: () => void;
  savedPlans?: Plan[];
  taskSessions?: TaskSession[];
  plannerTaskStates?: PlannerTaskState[];
  orders?: Order[];
  onContinueTask?: (sessionId: string) => void;
  onStartNewTask?: () => void;
  onOpenPlanCenter?: () => void;
  onOpenBudgetRecords?: () => void;
  onOpenOrders?: () => void;
  onNavigateToReady?: () => void;
  onViewOrderDetail?: (planId: string) => void;
}

type SettingItem = {
  id: string;
  label: string;
  desc?: string;
  value?: string;
};

export default memo(function Profile({
  onViewMemories,
  profiles,
  onUpdateProfiles,
  onBack,
  savedPlans = [],
  taskSessions = [],
  plannerTaskStates = [],
  orders = [],
  onContinueTask,
  onStartNewTask,
  onOpenPlanCenter,
  onOpenBudgetRecords,
  onOpenOrders,
  onNavigateToReady,
  onViewOrderDetail,
}: ProfileProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showCompanions, setShowCompanions] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const { orders: sharedOrders } = useOrders();

  const safeProfiles = Array.isArray(profiles) ? profiles : [];
  const safePlannerTaskStates = Array.isArray(plannerTaskStates) ? plannerTaskStates : [];
  const safeSavedPlans = Array.isArray(savedPlans) ? savedPlans : [];
  const safeTaskSessions = Array.isArray(taskSessions) ? taskSessions : [];

  const mainProfile = safeProfiles[0];
  const companionCount = Math.max(safeProfiles.length - 1, 0);
  const taskStateMap = new Map(safePlannerTaskStates.map((task) => [task.planId, task]));
  const planMap = new Map(
    safeSavedPlans
      .filter((plan): plan is Plan & { id: string } => !!plan.id)
      .map((plan) => [plan.id, plan])
  );
  const recentTasks = safeTaskSessions
    .filter((session) => session.messages.length > 0 || session.queryDraft || session.planTitle)
    .slice(0, 6)
    .map((session) => {
      const taskState = session.planId ? taskStateMap.get(session.planId) || null : null;
      const plan = session.planId ? planMap.get(session.planId) || null : null;
      const taskMeta = getPlannerTaskMeta(taskState?.status);
      const progressText = plan
        ? getPlannerTaskProgressText(taskState, plan.activities.length)
        : session.status === 'ready'
          ? '已生成方案'
          : session.status === 'planning'
            ? '分析中'
            : '未开始';

      // 提取前3个活动的地点名称
      const activityNames =
        plan?.activities
          ?.filter((act) => act.type !== 'travel')
          ?.slice(0, 3)
          ?.map((act) => act.title) || [];

      return {
        ...session,
        taskMeta,
        progressText,
        activityNames,
        plan,
      };
    });

  // 订单数据处理 - 使用共享 hook 的数据，按行程分组
  const safeOrders =
    Array.isArray(sharedOrders) && sharedOrders.length > 0
      ? sharedOrders
      : Array.isArray(orders)
        ? orders
        : [];
  const tripGroups = groupOrdersByTrip(safeOrders).slice(0, 3);

  const latestPlan = safeSavedPlans[0];
  const completedPlanIdSet = new Set(
    safePlannerTaskStates
      .filter((task) => task.status === 'completed' || task.status === 'archived')
      .map((task) => task.planId)
  );
  const memoryPlans = safeSavedPlans.filter((plan) => plan.id && completedPlanIdSet.has(plan.id));
  const plannedCount = recentTasks.filter((task) => task.planId).length;
  const readyToGoCount = safePlannerTaskStates.filter((task) => task.status === 'booked').length;
  const profileHighlights = [
    ...(mainProfile?.travelPreferences || []),
    ...(mainProfile?.dietaryPreferences || []),
    ...(mainProfile?.specialNeeds || []),
  ].slice(0, 5);

  const settingItems: SettingItem[] = [
    { id: 'profile', label: '我的档案', desc: '管理你的基础资料与出行风格' },
    { id: 'companions', label: '同行档案', desc: '统一管理身边人的偏好' },
    { id: 'cache', label: '清理缓存', value: '本地内容', desc: '释放草稿、图片和回忆缓存' },
  ];

  const selectedProfile = safeProfiles.find((profile) => profile.id === selectedProfileId) || null;

  const updateProfile = (profileId: string, patch: Partial<PersonProfile>) => {
    onUpdateProfiles(
      safeProfiles.map((profile) => (profile.id === profileId ? { ...profile, ...patch } : profile))
    );
  };

  const removeProfile = (profileId: string) => {
    if (safeProfiles.length <= 1) return;
    onUpdateProfiles(safeProfiles.filter((profile) => profile.id !== profileId));
    setSelectedProfileId(null);
  };

  const createCompanion = () => {
    onUpdateProfiles([
      ...safeProfiles,
      {
        id: `p_${Date.now()}`,
        name: '新同行人',
        relation: '朋友',
        ageGroup: '青年',
        dietaryPreferences: ['不吃太辣'],
        travelPreferences: ['城市漫步', '拍照'],
        budget: '中等',
        mobility: '正常',
        specialNeeds: [],
        favoriteActivities: ['咖啡馆'],
      },
    ]);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-transparent">
      <div className="px-5 pt-14 pb-5 bg-[#fbfcff]/88 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          {onBack ? (
            <button
              onClick={onBack}
              className="app-pill w-10 h-10 rounded-full flex items-center justify-center text-[var(--app-ink)] active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-10" />
          )}
          <div className="text-[18px] font-bold text-[#141821]">我的</div>
          <button
            onClick={() => setShowSettings(true)}
            className="app-pill w-10 h-10 rounded-full flex items-center justify-center text-[var(--app-ink)] active:scale-95"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => {
            if (mainProfile?.id) {
              setSelectedProfileId(mainProfile.id);
              setShowCompanions(true);
            }
          }}
          className="relative w-full overflow-hidden rounded-[24px] border border-[#FFD5E7] bg-[linear-gradient(135deg,#FFF7FB_0%,#FFE7F1_40%,#FFE7B8_100%)] px-5 py-4 shadow-[0_16px_34px_rgba(255,126,185,0.16)] text-left active:scale-[0.99]"
        >
          <div className="absolute -right-10 -top-8 h-28 w-28 rounded-full bg-white/40 blur-3xl" />
          <div className="absolute left-[-18px] bottom-[-16px] h-24 w-24 rounded-full bg-[#FFB347]/18 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="h-[76px] w-[76px] rounded-[24px] bg-white/82 p-1.5 shadow-[0_10px_22px_rgba(255,255,255,0.46)] backdrop-blur shrink-0 rotate-[-5deg]">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white">
                <img
                  src={mainProfile ? getAvatarPath(mainProfile) : '/mascot/smile.png'}
                  alt={mainProfile?.name || '用户头像'}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[20px] font-bold text-[#25130E] leading-none tracking-[-0.04em]">
                    {mainProfile?.name || '小明'}
                  </h2>
                  <span className="rounded-full bg-white/82 px-2.5 py-1 text-[10px] font-bold text-[#C94B86] shadow-sm">
                    {mainProfile?.relation || '我'}
                  </span>
                </div>
                <div className="mt-2 text-[13px] font-bold text-[#7D4B3E] line-clamp-1">
                  {latestPlan
                    ? `最近在看 ${latestPlan.title}`
                    : companionCount > 0
                      ? `和 ${companionCount} 位同行人一起出发`
                      : '今天想轻松逛逛，喝杯咖啡'}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {profileHighlights.slice(0, 3).map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/70 bg-white/78 px-3 py-1 text-[10px] font-bold text-[#5A2E3E] shadow-sm"
                  >
                    {item}
                  </span>
                ))}
                {profileHighlights.length === 0 && (
                  <span className="rounded-full border border-white/70 bg-white/78 px-3 py-1 text-[10px] font-bold text-[#5A2E3E] shadow-sm">
                    城市漫步
                  </span>
                )}
                <span className="rounded-full bg-[#111111] px-3 py-1 text-[10px] font-bold text-white shadow-[var(--shadow-md)]">
                  {mainProfile?.budget || '中等'}预算
                </span>
              </div>
            </div>
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4">
        <div className="app-card rounded-[24px] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[15px] font-bold text-[var(--app-ink)]">我的行程</div>
              <div className="mt-1 text-[13px] font-bold text-[var(--app-text)]">
                查看正在进行和已经保存的路线
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={onOpenPlanCenter}
              className="rounded-[24px] border border-[#E7ECF3] bg-[linear-gradient(180deg,#F8FBFF_0%,#F2F5F9_100%)] px-4 py-4 text-left active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-2xl bg-white border border-[#E7ECF3] flex items-center justify-center mb-3 shadow-sm">
                <Compass className="w-4 h-4 text-slate-700" />
              </div>
              <div className="text-[13px] font-bold text-[var(--app-ink)]">全部行程</div>
              <div className="mt-1 text-[11px] font-bold text-[var(--app-text)]">
                {plannedCount} 条在记录
              </div>
            </button>
            <button
              onClick={onNavigateToReady}
              className="rounded-[24px] border border-[var(--mint-strong)] bg-[linear-gradient(180deg,var(--mint-soft)_0%,#f4fbf7_100%)] px-4 py-4 text-left active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-2xl bg-white border border-[var(--mint-strong)] flex items-center justify-center mb-3 shadow-sm">
                <Route className="w-4 h-4 text-[var(--mint-ink)]" />
              </div>
              <div className="text-[13px] font-bold text-[var(--app-ink)]">待出发</div>
              <div className="mt-1 text-[11px] font-bold text-[var(--app-text)]">
                {readyToGoCount} 条已准备
              </div>
            </button>
            <button
              onClick={onOpenBudgetRecords}
              className="rounded-[24px] border border-[var(--peach-strong)] bg-[linear-gradient(180deg,var(--peach-soft)_0%,#fff8ef_100%)] px-4 py-4 text-left active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-2xl bg-white border border-[var(--peach-strong)] flex items-center justify-center mb-3 shadow-sm">
                <Wallet className="w-4 h-4 text-[var(--peach-ink)]" />
              </div>
              <div className="text-[13px] font-bold text-[var(--app-ink)]">预算记录</div>
              <div className="mt-1 text-[11px] font-bold text-[var(--app-text)]">
                {safeSavedPlans.length > 0
                  ? `最高 ¥${Math.max(...safeSavedPlans.map((plan) => plan.totalPrice ?? 0))}`
                  : '暂无'}
              </div>
            </button>
          </div>
        </div>

        <div className="rounded-[24px] bg-white border border-[var(--app-border)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[15px] font-bold text-[var(--app-ink)]">任务记录</div>
              <div className="mt-1 text-[13px] font-bold text-[var(--app-text)]">
                从这里继续之前的对话和规划
              </div>
            </div>
            <button
              onClick={onStartNewTask}
              className="h-10 rounded-full bg-[var(--app-ink)] px-4 text-[13px] font-bold text-white active:scale-[0.97] transition-transform"
            >
              新对话
            </button>
          </div>
          {recentTasks.length > 0 ? (
            <div className="space-y-2">
              {recentTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onContinueTask?.(task.id)}
                  className="w-full rounded-2xl bg-[#F7F8FA] px-3.5 py-3 text-left active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-bold text-[var(--app-ink)]">
                        {task.title}
                      </div>
                      <div className="mt-1 truncate text-[13px] font-bold text-[var(--app-text)]">
                        {task.summary || '继续当前任务'}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${task.taskMeta.pillClassName}`}
                      >
                        {task.planId
                          ? task.taskMeta.shortLabel
                          : task.status === 'ready'
                            ? '已生成'
                            : task.status === 'planning'
                              ? '进行中'
                              : '草稿'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 min-w-0">
                    {task.activityNames.length > 0 ? (
                      <>
                        <MapPin
                          className="w-3 h-3 text-[var(--app-text-soft)] shrink-0"
                          strokeWidth={2}
                        />
                        <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
                          {task.activityNames.slice(0, 3).map((name, idx) => (
                            <Fragment key={idx}>
                              <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-[var(--app-text)] truncate border border-[var(--app-border)] max-w-[90px]">
                                {name}
                              </span>
                            </Fragment>
                          ))}
                          {task.activityNames.length > 3 && (
                            <span className="shrink-0 rounded-full bg-[var(--app-card-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--app-text-soft)]">
                              +{task.activityNames.length - 3}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-[11px] font-bold text-[var(--app-text)]">
                        {task.progressText}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {task.durationTags && (
                      <span className="rounded-full bg-[var(--app-card-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--app-text)]">
                        {task.durationTags}
                      </span>
                    )}
                    {typeof task.totalPrice === 'number' && task.totalPrice > 0 && (
                      <span className="rounded-full bg-[var(--app-card-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--app-text)]">
                        ¥{task.totalPrice}
                      </span>
                    )}
                    {task.memberCount && task.memberCount > 1 && (
                      <span className="rounded-full bg-[var(--app-card-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--app-text)]">
                        {task.memberCount} 人
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] bg-[#F7F8FA] px-4 py-6">
              <EmptyState mood="working" title="还没有历史任务" description="去执行一次行程吧" />
            </div>
          )}
        </div>

        {/* 我的订单 */}
        <div className="rounded-[24px] bg-white border border-[var(--app-border)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[15px] font-bold text-[var(--app-ink)]">我的订单</div>
              <div className="mt-1 text-[13px] font-bold text-[var(--app-text)]">
                查看已预订的行程订单
              </div>
            </div>
            {tripGroups.length > 0 && (
              <button
                onClick={onOpenOrders}
                className="rounded-full bg-[var(--app-card-soft)] px-3 py-2 text-[11px] font-bold text-[var(--app-ink)] active:scale-95"
              >
                查看全部
              </button>
            )}
          </div>
          {tripGroups.length > 0 ? (
            <div className="space-y-3">
              {tripGroups.map((group) => {
                const date = new Date(group.createdAt);
                const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
                const statusInfo =
                  group.status === 'completed'
                    ? { label: '已完成', color: 'bg-green-100 text-green-700' }
                    : group.status === 'canceled'
                      ? {
                          label: '已取消',
                          color: 'bg-[var(--app-card-soft)] text-[var(--app-text)]',
                        }
                      : { label: '已支付', color: 'bg-blue-100 text-blue-700' };

                return (
                  <button
                    key={group.planId}
                    onClick={() => onViewOrderDetail?.(group.planId)}
                    className="w-full rounded-[24px] bg-[#F7F8FA] p-4 text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-bold text-[var(--app-ink)] truncate">
                          {group.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[11px] text-[var(--app-text-soft)] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dateStr}
                          </span>
                          <span className="text-[11px] text-[var(--app-text-soft)]">·</span>
                          <span className="text-[11px] text-[var(--app-text-soft)]">
                            {group.orders.length} 个订单
                          </span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="rounded-xl bg-white px-3.5 py-2.5 mb-3">
                      <div className="space-y-1.5">
                        {group.orders.slice(0, 2).map((order) => (
                          <div key={order.id} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                            <span className="text-[13px] text-[var(--app-ink)] truncate flex-1">
                              {order.merchantName || order.title?.split(' - ')[1] || order.title}
                            </span>
                            <span className="text-[13px] text-[var(--app-text)] shrink-0">
                              ¥{order.amount}
                            </span>
                          </div>
                        ))}
                        {group.orders.length > 2 && (
                          <div className="text-[11px] text-[var(--app-text-soft)] pl-3.5">
                            还有 {group.orders.length - 2} 个订单...
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[13px] text-[var(--app-text-soft)]">合计</span>
                        <span className="text-[18px] font-bold text-[var(--app-ink)] ml-1.5">
                          ¥{group.totalAmount}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--app-text-soft)]" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[24px] bg-[#F7F8FA] px-4 py-6">
              <EmptyState mood="coffee" title="还没有订单" description="执行行程后自动生成" />
            </div>
          )}
        </div>

        <div className="rounded-[24px] bg-white border border-[var(--app-border)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[15px] font-bold text-[var(--app-ink)]">同行档案</div>
              <div className="mt-1 text-[13px] font-bold text-[var(--app-text)]">
                保存身边人的偏好，下次共创会更快
              </div>
            </div>
            <button
              onClick={() => setShowCompanions(true)}
              className="rounded-full bg-[var(--app-card-soft)] px-3 py-2 text-[11px] font-bold text-[var(--app-ink)] active:scale-95"
            >
              管理
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto scrollbar-none">
            {safeProfiles.map((profile, idx) => (
              <button
                key={profile.id}
                onClick={() => {
                  setShowCompanions(true);
                  setSelectedProfileId(profile.id);
                }}
                className="min-w-[140px] rounded-[24px] border border-[var(--app-border)] bg-[var(--app-card-soft)] px-4 py-4 text-left active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full bg-white overflow-hidden border-2 border-white">
                    <img
                      src={getAvatarPath(profile)}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-[var(--app-ink)]">
                      {profile.name}
                    </div>
                    <div className="text-[11px] font-bold text-[var(--app-text)]">
                      {profile.relation}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(profile.travelPreferences || []).slice(0, 2).map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[var(--app-text)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] bg-white border border-[var(--app-border)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[15px] font-bold text-[var(--app-ink)]">我的回忆</div>
              <div className="mt-1 text-[13px] font-bold text-[var(--app-text)]">
                完成过的路线会留在这里
              </div>
            </div>
            <button
              onClick={onViewMemories}
              className="rounded-full bg-[var(--app-card-soft)] px-3 py-2 text-[11px] font-bold text-[var(--app-ink)] active:scale-95"
            >
              查看全部
            </button>
          </div>
          {memoryPlans.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto scrollbar-none">
              {memoryPlans.slice(0, 4).map((plan) => (
                <button
                  key={plan.id}
                  onClick={onViewMemories}
                  className="min-w-[210px] rounded-[24px] border border-[var(--app-border)] bg-[#F7F8FA] px-4 py-3 text-left active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="text-[15px] font-bold text-[var(--app-ink)] line-clamp-2 flex-1">
                      {plan.title}
                    </div>
                    <BookOpen className="w-4 h-4 text-[var(--app-text-soft)] shrink-0 mt-0.5" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {plan.durationTags && (
                      <span className="rounded-full bg-[var(--peach-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--peach-ink)]">
                        {plan.durationTags}
                      </span>
                    )}
                    {plan.activities.slice(0, 3).map((act) => (
                      <span
                        key={act.id}
                        className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-[var(--app-text)] max-w-[80px] truncate"
                      >
                        {act.title}
                      </span>
                    ))}
                    {plan.activities.length > 3 && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[var(--app-text)]">
                        +{plan.activities.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] bg-[#F7F8FA] px-4 py-6">
              <EmptyState
                mood="love"
                title="还没有回忆内容"
                description="完成行程后会留下美好回忆"
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <BottomSheet title="设置" onClose={() => setShowSettings(false)}>
            <div className="space-y-3">
              {settingItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'profile') {
                      setShowSettings(false);
                      setSelectedProfileId(mainProfile?.id || null);
                      setShowCompanions(true);
                    } else if (item.id === 'companions') {
                      setShowSettings(false);
                      setShowCompanions(true);
                    } else if (item.id === 'cache') {
                      resetAppStorage();
                      window.location.reload();
                    }
                  }}
                  className="w-full rounded-[24px] bg-white border border-[var(--app-border)] p-4 text-left shadow-[var(--shadow-sm)] active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-bold text-[var(--app-ink)]">
                        {item.label}
                      </div>
                      {item.desc && (
                        <div className="mt-1 text-[13px] font-bold text-[var(--app-text)]">
                          {item.desc}
                        </div>
                      )}
                    </div>
                    {item.value ? (
                      <span className="text-[11px] font-bold text-[var(--app-text-soft)]">
                        {item.value}
                      </span>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-[var(--app-text-soft)]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCompanions && (
          <BottomSheet
            title="同行档案"
            onClose={() => {
              setShowCompanions(false);
              setSelectedProfileId(null);
            }}
            actionLabel="新增"
            onAction={createCompanion}
          >
            {selectedProfile ? (
              <ProfileEditor
                profile={selectedProfile}
                onClose={() => setSelectedProfileId(null)}
                onChange={(patch) => updateProfile(selectedProfile.id, patch)}
                onDelete={profiles.length > 1 ? () => removeProfile(selectedProfile.id) : undefined}
              />
            ) : (
              <div className="space-y-3">
                {profiles.map((profile, idx) => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfileId(profile.id)}
                    className="w-full rounded-[24px] bg-white border border-[var(--app-border)] p-4 shadow-[var(--shadow-sm)] active:scale-[0.98] text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-white overflow-hidden border-2 border-white shrink-0">
                        <img
                          src={getAvatarPath(profile)}
                          alt={profile.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-[15px] font-bold text-[var(--app-ink)]">
                            {profile.name}
                          </div>
                          <span className="rounded-full bg-[var(--app-card-soft)] px-2 py-1 text-[10px] font-bold text-[var(--app-text)]">
                            {profile.relation}
                          </span>
                        </div>
                        <div className="mt-1 text-[13px] font-bold text-[var(--app-text)]">
                          {profile.ageGroup} · {profile.budget || '中等'}预算
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(profile.travelPreferences || []).slice(0, 3).map((item) => (
                            <span
                              key={item}
                              className="rounded-full bg-[var(--rose-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--rose-ink)]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[var(--app-text-soft)] shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  );
});

function BottomSheet({
  title,
  children,
  onClose,
  actionLabel,
  onAction,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="absolute bottom-0 left-0 right-0 rounded-t-[32px] bg-[#F7F8FA] max-h-[84vh] overflow-hidden shadow-[0_-16px_48px_rgba(0,0,0,0.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-3 pb-4 bg-[#F7F8FA] border-b border-[var(--app-border)] sticky top-0 z-10">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200"></div>
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white border border-[var(--app-border)] flex items-center justify-center text-[var(--app-ink)] active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-[18px] font-bold text-[var(--app-ink)]">{title}</div>
            {actionLabel && onAction ? (
              <button
                onClick={onAction}
                className="rounded-full bg-[var(--app-ink)] px-3.5 py-2 text-[11px] font-bold text-white active:scale-95"
              >
                {actionLabel}
              </button>
            ) : (
              <div className="w-10"></div>
            )}
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-5 pb-8 max-h-[calc(84vh-72px)]">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function ProfileEditor({
  profile,
  onClose,
  onChange,
  onDelete,
}: {
  profile: PersonProfile;
  onClose: () => void;
  onChange: (patch: Partial<PersonProfile>) => void;
  onDelete?: () => void;
}) {
  // AI 偏好数据
  const [aiPrefs, setAiPrefs] = useState<{
    favoriteCategories: string[];
    avoidCategories: string[];
    dietaryRestrictions: string[];
    recentSearches: string[];
  }>({ favoriteCategories: [], avoidCategories: [], dietaryRestrictions: [], recentSearches: [] });

  // 自定义输入
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({
    dietaryPreferences: '',
    travelPreferences: '',
    specialNeeds: '',
    favoriteActivities: '',
  });
  const editorMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      editorMountedRef.current = false;
    };
  }, []);

  // 加载 AI 偏好
  useEffect(() => {
    const ac = new AbortController();
    fetch(apiUrl('/api/preferences'), { credentials: 'include', signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (editorMountedRef.current && data?.preferences) {
          setAiPrefs({
            favoriteCategories: data.preferences.favoriteCategories || [],
            avoidCategories: data.preferences.avoidCategories || [],
            dietaryRestrictions: data.preferences.dietaryRestrictions || [],
            recentSearches: data.preferences.recentSearches || [],
          });
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      });
    return () => {
      ac.abort();
    };
  }, []);

  const quickTags = {
    dietaryPreferences: ['不吃太辣', '低碳水', '高蛋白', '素食'],
    travelPreferences: ['城市漫步', '拍照', '亲子互动', '小众店铺'],
    specialNeeds: ['婴儿车', '无障碍', '午休', '安静环境'],
    favoriteActivities: ['咖啡馆', '公园', '展览', '小吃街'],
  };

  // 获取某个分类的 AI 标签
  const getAiTags = (key: string): string[] => {
    switch (key) {
      case 'dietaryPreferences':
        return aiPrefs.dietaryRestrictions.filter((t) => !profile.dietaryPreferences?.includes(t));
      case 'travelPreferences':
        return aiPrefs.favoriteCategories.filter((t) => !profile.travelPreferences?.includes(t));
      case 'favoriteActivities':
        return aiPrefs.favoriteCategories.filter((t) => !profile.favoriteActivities?.includes(t));
      case 'specialNeeds':
        // 从最近搜索中推断特殊需求
        const needs = aiPrefs.recentSearches.filter(
          (s) =>
            s.includes('婴儿') || s.includes('无障碍') || s.includes('安静') || s.includes('午休')
        );
        return needs
          .map((s) => {
            if (s.includes('婴儿')) return '婴儿车';
            if (s.includes('无障碍')) return '无障碍';
            if (s.includes('安静')) return '安静环境';
            if (s.includes('午休')) return '午休';
            return s;
          })
          .filter((t) => !profile.specialNeeds?.includes(t));
      default:
        return [];
    }
  };

  // 确认 AI 标签为用户选择
  const confirmAiTag = (key: string, tag: string) => {
    const current = ((profile as unknown as Record<string, unknown>)[key] as string[]) || [];
    onChange({ [key]: [...current, tag] } as Partial<PersonProfile>);
    // 同步到后端偏好
    fetch(apiUrl('/api/preferences'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favoriteCategories: [...(profile.favoriteActivities || []), tag] }),
    }).catch(() => {});
  };

  // 添加自定义标签
  const addCustomTag = (key: string) => {
    const value = customInputs[key]?.trim();
    if (!value) return;
    const current = ((profile as unknown as Record<string, unknown>)[key] as string[]) || [];
    if (current.includes(value)) return;
    onChange({ [key]: [...current, value] } as Partial<PersonProfile>);
    setCustomInputs((prev) => ({ ...prev, [key]: '' }));
    // 同步到后端
    fetch(apiUrl('/api/preferences'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favoriteCategories: [...(profile.favoriteActivities || []), value] }),
    }).catch(() => {});
  };

  const renderTags = (key: keyof typeof quickTags, label: string, values: string[] = []) => {
    const aiTags = getAiTags(key);
    const presets = quickTags[key].filter((tag) => !values.includes(tag) && !aiTags.includes(tag));

    return (
      <div className="rounded-[24px] bg-white border border-[var(--app-border)] p-4 shadow-[var(--shadow-sm)]">
        <div className="text-[13px] font-bold text-[var(--app-ink)] mb-3">{label}</div>

        {/* 用户选择的标签 */}
        <div className="flex flex-wrap gap-2 mb-3">
          {values.map((tag) => (
            <button
              key={tag}
              onClick={() => onChange({ [key]: values.filter((item) => item !== tag) })}
              className="rounded-full bg-[var(--app-card-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--app-ink)] active:scale-95"
            >
              {tag} ×
            </button>
          ))}

          {/* AI 学习的标签 */}
          {aiTags.map((tag) => (
            <button
              key={`ai-${tag}`}
              onClick={() => confirmAiTag(key, tag)}
              className="rounded-full bg-[var(--info-soft)] border border-blue-200 px-3 py-1.5 text-[11px] font-bold text-blue-700 active:scale-95"
              title="AI 学习的偏好，点击确认"
            >
              {tag} 🤖
            </button>
          ))}
        </div>

        {/* 预设推荐 */}
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {presets.map((tag) => (
              <button
                key={tag}
                onClick={() => onChange({ [key]: [...values, tag] })}
                className="rounded-full border border-dashed border-[var(--app-border)] px-3 py-1.5 text-[11px] font-bold text-[var(--app-text)] active:scale-95"
              >
                + {tag}
              </button>
            ))}
          </div>
        )}

        {/* 自定义输入 */}
        <div className="flex gap-2 mt-2">
          <input
            value={customInputs[key] || ''}
            onChange={(e) => setCustomInputs((prev) => ({ ...prev, [key]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addCustomTag(key);
            }}
            placeholder="自定义输入..."
            className="flex-1 rounded-full border border-[var(--app-border)] px-3 py-1.5 text-[11px] font-bold text-[var(--app-ink)] outline-none focus:border-blue-300"
          />
          <button
            onClick={() => addCustomTag(key)}
            className="rounded-full bg-[var(--app-ink)] px-3 py-1.5 text-[11px] font-bold text-white active:scale-95"
          >
            添加
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[var(--rose-strong)] bg-[linear-gradient(135deg,var(--rose-soft)_0%,#fffafc_44%,var(--peach-soft)_100%)] p-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-white overflow-hidden border-2 border-white shadow-sm shrink-0">
            <img
              src={getAvatarPath(profile)}
              alt={profile.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-bold text-[var(--app-ink)]">{profile.name}</div>
            <div className="mt-1 text-[13px] font-bold text-[var(--app-text)]">
              {profile.relation} · {profile.ageGroup}
            </div>
            <div className="mt-3 text-[11px] font-bold text-[var(--rose-ink)] leading-relaxed">
              这些信息会影响多人共创时的偏好平衡、餐厅筛选和路线节奏。
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-white shadow-sm flex items-center justify-center text-[var(--app-text)] active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="rounded-[24px] bg-white border border-[var(--app-border)] p-4 shadow-[var(--shadow-sm)]">
          <div className="text-[11px] font-bold text-[var(--app-text)] mb-2">姓名</div>
          <input
            value={profile.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full bg-transparent text-[13px] font-bold text-[var(--app-ink)] outline-none"
          />
        </label>
        <label className="rounded-[24px] bg-white border border-[var(--app-border)] p-4 shadow-[var(--shadow-sm)]">
          <div className="text-[11px] font-bold text-[var(--app-text)] mb-2">关系</div>
          <select
            value={profile.relation}
            onChange={(e) => onChange({ relation: e.target.value })}
            className="w-full bg-transparent text-[13px] font-bold text-[var(--app-ink)] outline-none"
          >
            {['我', '家人', '伴侣', '朋友', '同事', '孩子', '长辈'].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-[24px] bg-white border border-[var(--app-border)] p-4 shadow-[var(--shadow-sm)]">
          <div className="text-[11px] font-bold text-[var(--app-text)] mb-2">年龄段</div>
          <select
            value={profile.ageGroup}
            onChange={(e) => onChange({ ageGroup: e.target.value })}
            className="w-full bg-transparent text-[13px] font-bold text-[var(--app-ink)] outline-none"
          >
            {['儿童', '青少年', '青年', '中年', '老年'].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-[24px] bg-white border border-[var(--app-border)] p-4 shadow-[var(--shadow-sm)]">
          <div className="text-[11px] font-bold text-[var(--app-text)] mb-2">性别</div>
          <select
            value={profile.gender || ''}
            onChange={(e) => onChange({ gender: e.target.value as 'male' | 'female' })}
            className="w-full bg-transparent text-[13px] font-bold text-[var(--app-ink)] outline-none"
          >
            <option value="">自动推断</option>
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </label>
        <label className="rounded-[24px] bg-white border border-[var(--app-border)] p-4 shadow-[var(--shadow-sm)]">
          <div className="text-[11px] font-bold text-[var(--app-text)] mb-2">形象风格</div>
          <select
            value={profile.styleTag || ''}
            onChange={(e) => onChange({ styleTag: e.target.value })}
            className="w-full bg-transparent text-[13px] font-bold text-[var(--app-ink)] outline-none"
          >
            <option value="">自动匹配</option>
            {getStyleTagsForAgeGroup(profile.ageGroup, profile.gender).map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-[24px] bg-white border border-[var(--app-border)] p-4 shadow-[var(--shadow-sm)]">
          <div className="text-[11px] font-bold text-[var(--app-text)] mb-2">预算</div>
          <select
            value={profile.budget || '中等'}
            onChange={(e) => onChange({ budget: e.target.value })}
            className="w-full bg-transparent text-[13px] font-bold text-[var(--app-ink)] outline-none"
          >
            {['经济', '中等', '较高', '不限'].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {renderTags('dietaryPreferences', '饮食偏好', profile.dietaryPreferences || [])}
      {renderTags('travelPreferences', '游玩偏好', profile.travelPreferences || [])}
      {renderTags('specialNeeds', '特殊需求', profile.specialNeeds || [])}
      {renderTags('favoriteActivities', '喜欢的活动', profile.favoriteActivities || [])}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[24px] bg-white border border-[var(--app-border)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-[var(--app-text)]" />
            <div className="text-[13px] font-bold text-[var(--app-ink)]">出行能力</div>
          </div>
          <div className="text-[13px] font-bold text-[var(--app-text)]">
            {profile.mobility || '正常'}
          </div>
        </div>
        <div className="rounded-[24px] bg-white border border-[var(--app-border)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--mint-ink)]" />
            <div className="text-[13px] font-bold text-[var(--app-ink)]">适配状态</div>
          </div>
          <div className="text-[13px] font-bold text-[var(--app-text)]">已加入共创决策</div>
        </div>
      </div>

      {onDelete && (
        <button
          onClick={onDelete}
          className="flex w-full items-center justify-center gap-2 rounded-[24px] border py-4 text-[13px] font-bold text-[var(--danger-ink)] active:scale-[0.98]"
          style={{ background: 'var(--danger-soft)', borderColor: '#ffd6dd' }}
        >
          <Trash2 className="w-4 h-4" />
          删除该档案
        </button>
      )}
    </div>
  );
}
