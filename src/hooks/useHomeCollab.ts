/**
 * useHomeCollab - Home 页协作模式管理 hook
 *
 * 从 Home.tsx 中提取的协作相关逻辑：
 * - 协作面板开关
 * - 成员选择/投票/避雷
 * - 临时成员管理
 * - 协作摘要计算
 * - 邀请分享
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import type {
  PersonProfile,
  TaskSession,
  VoteOptionId,
  AvoidOptionId,
  TieBreakerId,
} from '../types';
import { shareText } from '../services/clientActions';
import type { CollabSummary } from './useHomeChat';

// ── 常量 ──

export const voteOptions: Array<{ id: VoteOptionId; label: string; hint: string; color: string }> =
  [
    {
      id: 'food',
      label: '吃好一点',
      hint: '餐厅体验更重要',
      color: 'bg-orange-50 text-orange-600',
    },
    {
      id: 'photo',
      label: '拍照出片',
      hint: '路线更重氛围和打卡',
      color: 'bg-pink-50 text-pink-600',
    },
    { id: 'easy', label: '轻松少走', hint: '节奏慢一点', color: 'bg-emerald-50 text-emerald-600' },
    { id: 'dense', label: '多玩几个点', hint: '效率高一点', color: 'bg-blue-50 text-blue-600' },
    { id: 'budget', label: '预算友好', hint: '控制人均花费', color: 'bg-amber-50 text-amber-700' },
    { id: 'queue', label: '尽量少排队', hint: '避开高峰', color: 'bg-violet-50 text-violet-600' },
    { id: 'child', label: '带娃友好', hint: '适合小朋友', color: 'bg-cyan-50 text-cyan-600' },
    { id: 'elder', label: '长辈友好', hint: '更稳妥舒适', color: 'bg-slate-100 text-slate-600' },
  ];

export const avoidOptions: Array<{ id: AvoidOptionId; label: string }> = [
  { id: 'spicy', label: '太辣' },
  { id: 'queue', label: '长时间排队' },
  { id: 'walk', label: '走太多路' },
  { id: 'expensive', label: '消费过高' },
  { id: 'crowd', label: '人太多' },
  { id: 'late', label: '太晚结束' },
];

export const tieBreakerOptions: Array<{ id: TieBreakerId; label: string; desc: string }> = [
  { id: 'easy_over_dense', label: '轻松优先', desc: '冲突时宁可少去一个点' },
  { id: 'dense_over_easy', label: '体验优先', desc: '冲突时尽量多覆盖几个点' },
  { id: 'budget_over_food', label: '预算优先', desc: '冲突时先把人均控住' },
  { id: 'food_over_budget', label: '餐饮优先', desc: '冲突时优先保留更好的餐饮' },
];

const conflictPairs: Array<{ a: VoteOptionId; b: VoteOptionId; label: string }> = [
  { a: 'dense', b: 'easy', label: '既想多玩几个点，也希望轻松少走' },
  { a: 'budget', b: 'food', label: '既想控制预算，也想吃得更好' },
];

// ── 工具函数 ──

function getDefaultVotes(profile: PersonProfile): VoteOptionId[] {
  const votes: VoteOptionId[] = [];
  if (profile.ageGroup === '儿童') votes.push('child');
  if (profile.ageGroup === '老年') votes.push('elder');
  if (profile.relation === '伴侣') votes.push('photo');
  if (votes.length === 0) votes.push('food');
  return votes.slice(0, 2);
}

export function buildCollabSummary(
  selectedProfiles: PersonProfile[],
  memberVotes: Record<string, VoteOptionId[]>,
  strategy: 'balanced' | 'care' | 'efficient',
  memberAvoids: Record<string, AvoidOptionId[]>,
  tieBreaker: TieBreakerId
): CollabSummary {
  const voteMap = new Map(voteOptions.map((o) => [o.id, o]));
  const counts = new Map<VoteOptionId, number>();
  selectedProfiles.forEach((p) => {
    (memberVotes[p.id] || []).forEach((v) => {
      counts.set(v, (counts.get(v) || 0) + 1);
    });
  });

  const consensus = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => voteMap.get(id)?.label || id);
  const conflicts = conflictPairs
    .filter((pair) => (counts.get(pair.a) || 0) > 0 && (counts.get(pair.b) || 0) > 0)
    .map((pair) => pair.label);
  const missingMembers = selectedProfiles.filter((p) => (memberVotes[p.id] || []).length === 0);
  const memberSummaries = selectedProfiles.map((p) => ({
    id: p.id,
    name: p.name,
    relation: p.relation,
    votes: (memberVotes[p.id] || []).map((v) => voteMap.get(v)?.label || v),
    avoids: (memberAvoids[p.id] || []).map((a) => avoidOptions.find((o) => o.id === a)?.label || a),
  }));

  const avoidCounts = new Map<AvoidOptionId, number>();
  selectedProfiles.forEach((p) => {
    (memberAvoids[p.id] || []).forEach((a) => {
      avoidCounts.set(a, (avoidCounts.get(a) || 0) + 1);
    });
  });
  const topAvoids = [...avoidCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => avoidOptions.find((o) => o.id === id)?.label || id);

  const strategyLabel =
    strategy === 'care' ? '优先照顾' : strategy === 'efficient' ? '效率优先' : '民主共识';
  const tieBreakerLabel = tieBreakerOptions.find((o) => o.id === tieBreaker)?.label || '轻松优先';
  const analysisText = [
    `已纳入 ${selectedProfiles.length} 位成员意见`,
    consensus.length > 0 ? `当前共识：${consensus.join('、')}` : '当前还没有形成明确共识',
    topAvoids.length > 0 ? `共同避雷：${topAvoids.join('、')}` : '',
    conflicts.length > 0 ? `待平衡：${conflicts.join('；')}` : '',
    missingMembers.length > 0 ? `未投票：${missingMembers.map((p) => p.name).join('、')}` : '',
  ]
    .filter(Boolean)
    .join('，');

  return {
    counts,
    consensus,
    conflicts,
    missingMembers,
    memberSummaries,
    strategyLabel,
    analysisText,
    topAvoids,
    tieBreakerLabel,
  };
}

// ── 邀请 Payload 类型 ──

interface InviteProfileSnapshot {
  inviteId: string;
  name: string;
  relation: string;
  ageGroup: string;
  dietaryPreferences: string[];
  travelPreferences: string[];
  avoidPreferences?: string[];
  budget?: string;
  mobility?: string;
  specialNeeds?: string[];
  favoriteActivities?: string[];
}

interface CollabInvitePayload {
  version: 'v1';
  inviter: string;
  createdAt: number;
  sessionTitle: string;
  query: string;
  timePref: string;
  targetType: string;
  collabStrategy: 'balanced' | 'care' | 'efficient';
  tieBreaker: TieBreakerId;
  profiles: InviteProfileSnapshot[];
  selectedProfileInviteIds: string[];
  memberVotes: Record<string, VoteOptionId[]>;
  memberAvoids: Record<string, AvoidOptionId[]>;
}

function encodeInvitePayload(payload: CollabInvitePayload) {
  return btoa(encodeURIComponent(JSON.stringify(payload)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

// ── Hook ──

interface UseHomeCollabParams {
  profiles: PersonProfile[];
  defaultBaseProfileId: string;
  activeSession: TaskSession | null;
  mainUser: PersonProfile | undefined;
  query: string;
}

interface UseHomeCollabReturn {
  isCollabOpen: boolean;
  setIsCollabOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedProfileIds: Set<string>;
  setSelectedProfileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeVoterId: string;
  setActiveVoterId: React.Dispatch<React.SetStateAction<string>>;
  targetType: string;
  setTargetType: React.Dispatch<React.SetStateAction<string>>;
  timePref: string;
  setTimePref: React.Dispatch<React.SetStateAction<string>>;
  collabStrategy: 'balanced' | 'care' | 'efficient';
  setCollabStrategy: React.Dispatch<React.SetStateAction<'balanced' | 'care' | 'efficient'>>;
  memberVotes: Record<string, VoteOptionId[]>;
  setMemberVotes: React.Dispatch<React.SetStateAction<Record<string, VoteOptionId[]>>>;
  memberAvoids: Record<string, AvoidOptionId[]>;
  setMemberAvoids: React.Dispatch<React.SetStateAction<Record<string, AvoidOptionId[]>>>;
  tieBreaker: TieBreakerId;
  setTieBreaker: React.Dispatch<React.SetStateAction<TieBreakerId>>;
  sessionTempProfiles: PersonProfile[];
  setSessionTempProfiles: React.Dispatch<React.SetStateAction<PersonProfile[]>>;
  showAddMember: boolean;
  setShowAddMember: React.Dispatch<React.SetStateAction<boolean>>;
  inviteError: string | null;
  setInviteError: React.Dispatch<React.SetStateAction<string | null>>;
  inviteFeedback: 'idle' | 'done';
  setInviteFeedback: React.Dispatch<React.SetStateAction<'idle' | 'done'>>;
  newMemberName: string;
  setNewMemberName: React.Dispatch<React.SetStateAction<string>>;
  newMemberRelation: string;
  setNewMemberRelation: React.Dispatch<React.SetStateAction<string>>;
  newMemberAge: string;
  setNewMemberAge: React.Dispatch<React.SetStateAction<string>>;
  combinedProfiles: PersonProfile[];
  selectedProfiles: PersonProfile[];
  collabSummary: CollabSummary;
  toggleProfileSelect: (id: string) => void;
  toggleMemberVote: (profileId: string, voteId: VoteOptionId) => void;
  toggleMemberAvoid: (profileId: string, avoidId: AvoidOptionId) => void;
  handleInviteMoreFriends: () => Promise<void>;
  handleAddTempMember: () => void;
  conflictChoiceCard: { title: string; options: typeof tieBreakerOptions } | null;
}

export function useHomeCollab(params: UseHomeCollabParams): UseHomeCollabReturn {
  const { profiles, defaultBaseProfileId, activeSession, mainUser, query } = params;

  const [isCollabOpen, setIsCollabOpen] = useState(false);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    new Set([defaultBaseProfileId])
  );
  const [activeVoterId, setActiveVoterId] = useState(defaultBaseProfileId);
  const [targetType, setTargetType] = useState('附近 (3km)');
  const [timePref, setTimePref] = useState('上午出发');
  const [collabStrategy, setCollabStrategy] = useState<'balanced' | 'care' | 'efficient'>(
    'balanced'
  );
  const [memberVotes, setMemberVotes] = useState<Record<string, VoteOptionId[]>>({});
  const [memberAvoids, setMemberAvoids] = useState<Record<string, AvoidOptionId[]>>({});
  const [tieBreaker, setTieBreaker] = useState<TieBreakerId>('easy_over_dense');
  const [sessionTempProfiles, setSessionTempProfiles] = useState<PersonProfile[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<'idle' | 'done'>('idle');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRelation, setNewMemberRelation] = useState('朋友');
  const [newMemberAge, setNewMemberAge] = useState('青年');
  const inviteFeedbackTimerRef = useRef<number | null>(null);

  // 确保 combinedProfiles 不会有重复成员
  const combinedProfiles = useMemo(() => {
    const existingIds = new Set(profiles.map((p) => p.id));
    const uniqueTempProfiles = sessionTempProfiles.filter((p) => !existingIds.has(p.id));
    return [...profiles, ...uniqueTempProfiles];
  }, [profiles, sessionTempProfiles]);
  const selectedProfiles = useMemo(
    () => combinedProfiles.filter((p) => selectedProfileIds.has(p.id)),
    [combinedProfiles, selectedProfileIds]
  );
  const collabSummary = useMemo(
    () =>
      buildCollabSummary(selectedProfiles, memberVotes, collabStrategy, memberAvoids, tieBreaker),
    [selectedProfiles, memberVotes, collabStrategy, memberAvoids, tieBreaker]
  );

  const conflictChoiceCard = useMemo(
    () =>
      collabSummary.conflicts.length > 0
        ? {
            title: collabSummary.conflicts[0],
            options: tieBreakerOptions.filter((o) =>
              collabSummary.conflicts[0].includes('多玩几个点')
                ? o.id === 'easy_over_dense' || o.id === 'dense_over_easy'
                : o.id === 'budget_over_food' || o.id === 'food_over_budget'
            ),
          }
        : null,
    [collabSummary.conflicts]
  );

  const toggleProfileSelect = useCallback((id: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setActiveVoterId(id);
  }, []);

  const toggleMemberVote = useCallback((profileId: string, voteId: VoteOptionId) => {
    setMemberVotes((prev) => {
      const current = prev[profileId] || [];
      const exists = current.includes(voteId);
      if (exists) return { ...prev, [profileId]: current.filter((v) => v !== voteId) };
      return { ...prev, [profileId]: [...current, voteId].slice(-2) };
    });
  }, []);

  const toggleMemberAvoid = useCallback((profileId: string, avoidId: AvoidOptionId) => {
    setMemberAvoids((prev) => {
      const current = prev[profileId] || [];
      const exists = current.includes(avoidId);
      if (exists) return { ...prev, [profileId]: current.filter((a) => a !== avoidId) };
      return { ...prev, [profileId]: [...current, avoidId].slice(-2) };
    });
  }, []);

  const handleAddTempMember = useCallback(() => {
    if (!newMemberName.trim()) return;
    const newProfile: PersonProfile = {
      id: `p${Date.now()}`,
      name: newMemberName.trim(),
      relation: newMemberRelation,
      ageGroup: newMemberAge,
      dietaryPreferences: [],
      travelPreferences: [],
      avoidPreferences: [],
      budget: '中等',
      mobility: '正常',
      specialNeeds: [],
      favoriteActivities: [],
    };
    setSessionTempProfiles((prev) => [...prev, newProfile]);
    setSelectedProfileIds((prev) => new Set([...prev, newProfile.id]));
    setActiveVoterId(newProfile.id);
    setNewMemberName('');
    setShowAddMember(false);
  }, [newMemberName, newMemberRelation, newMemberAge]);

  const handleInviteMoreFriends = useCallback(async () => {
    if (selectedProfiles.length === 0) return;
    const inviteProfiles = selectedProfiles.map((p) => ({
      inviteId: p.id,
      name: p.name,
      relation: p.relation,
      ageGroup: p.ageGroup,
      dietaryPreferences: p.dietaryPreferences || [],
      travelPreferences: p.travelPreferences || [],
      avoidPreferences: p.avoidPreferences || [],
      budget: p.budget,
      mobility: p.mobility,
      specialNeeds: p.specialNeeds || [],
      favoriteActivities: p.favoriteActivities || [],
    }));
    const payload: CollabInvitePayload = {
      version: 'v1',
      inviter: mainUser?.name || '朋友',
      createdAt: Date.now(),
      sessionTitle: activeSession?.planTitle || activeSession?.title || '一起共创一条新路线',
      query,
      timePref,
      targetType,
      collabStrategy,
      tieBreaker,
      profiles: inviteProfiles,
      selectedProfileInviteIds: inviteProfiles.map((p) => p.inviteId),
      memberVotes: Object.fromEntries(
        inviteProfiles.map((p) => [p.inviteId, memberVotes[p.inviteId] || []])
      ),
      memberAvoids: Object.fromEntries(
        inviteProfiles.map((p) => [p.inviteId, memberAvoids[p.inviteId] || []])
      ),
    };
    const inviteUrl = new URL(window.location.href);
    inviteUrl.searchParams.set('invite', encodeInvitePayload(payload));
    const title = `${mainUser?.name || '朋友'}邀请你一起共创行程`;
    const text = [
      payload.sessionTitle || '一起共创一条新路线',
      `${selectedProfiles.length} 人已加入`,
      `${timePref} · ${targetType}`,
    ].join('\n');
    const shared = await shareText({ title, text, url: inviteUrl.toString() });
    if (shared) {
      setInviteFeedback('done');
      if (inviteFeedbackTimerRef.current) window.clearTimeout(inviteFeedbackTimerRef.current);
      inviteFeedbackTimerRef.current = window.setTimeout(() => setInviteFeedback('idle'), 1800);
    }
  }, [
    selectedProfiles,
    mainUser,
    activeSession,
    query,
    timePref,
    targetType,
    collabStrategy,
    tieBreaker,
    memberVotes,
    memberAvoids,
  ]);

  return {
    isCollabOpen,
    setIsCollabOpen,
    selectedProfileIds,
    setSelectedProfileIds,
    activeVoterId,
    setActiveVoterId,
    targetType,
    setTargetType,
    timePref,
    setTimePref,
    collabStrategy,
    setCollabStrategy,
    memberVotes,
    setMemberVotes,
    memberAvoids,
    setMemberAvoids,
    tieBreaker,
    setTieBreaker,
    sessionTempProfiles,
    setSessionTempProfiles,
    showAddMember,
    setShowAddMember,
    inviteError,
    setInviteError,
    inviteFeedback,
    setInviteFeedback,
    newMemberName,
    setNewMemberName,
    newMemberRelation,
    setNewMemberRelation,
    newMemberAge,
    setNewMemberAge,
    combinedProfiles,
    selectedProfiles,
    collabSummary,
    toggleProfileSelect,
    toggleMemberVote,
    toggleMemberAvoid,
    handleInviteMoreFriends,
    handleAddTempMember,
    conflictChoiceCard,
  };
}
