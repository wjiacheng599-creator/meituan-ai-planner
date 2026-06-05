import { motion, AnimatePresence } from 'motion/react';
import type { Plan } from '../../services/ai';
import {
  ChevronLeft,
  Share2,
  Copy,
  Download,
  MessageCircle,
  MapPin,
  CheckCircle2,
  Ticket,
  Image as ImageIcon,
  BookOpen,
  Sparkles,
  Users,
} from 'lucide-react';
import type { PersonProfile, PlannerTaskState } from '../../types';
import { getPlannerTaskMeta, getPlannerTaskProgressText } from '../../utils/plannerTask';
import { getAvatarPath } from '../../utils/avatarUtils';
import { copyText, downloadSvgPoster, shareText } from '../../services/clientActions';
import { createShareArtifactViaServer } from '../../services/serverApi';
import { useEffect, useMemo, useState } from 'react';

interface ShareProps {
  plan: Plan | null;
  onBack: () => void;
  onComplete: () => void;
  profiles?: PersonProfile[];
  taskState?: PlannerTaskState | null;
  standalone?: boolean;
  onNavigate?: (screen: string) => void;
}

type TemplateType = 'default' | 'receipt' | 'polaroid' | 'notebook';

interface TemplateOption {
  id: TemplateType;
  name: string;
  icon: React.ReactNode;
  bgColor: string;
  activeBg: string;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'default',
    name: '默认',
    icon: <CheckCircle2 className="w-4 h-4" />,
    bgColor: 'bg-white',
    activeBg: 'bg-sky-100',
  },
  {
    id: 'receipt',
    name: '小票',
    icon: <Ticket className="w-4 h-4" />,
    bgColor: 'bg-white',
    activeBg: 'bg-amber-100',
  },
  {
    id: 'polaroid',
    name: '拍立得',
    icon: <ImageIcon className="w-4 h-4" />,
    bgColor: 'bg-white',
    activeBg: 'bg-pink-100',
  },
  {
    id: 'notebook',
    name: '笔记本',
    icon: <BookOpen className="w-4 h-4" />,
    bgColor: 'bg-white',
    activeBg: 'bg-emerald-100',
  },
];

export default function Share({
  plan,
  onBack,
  onComplete,
  profiles = [],
  taskState = null,
  standalone = false,
  onNavigate,
}: ShareProps) {
  const [shareUrl, setShareUrl] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('default');

  const shareLink = useMemo(
    () =>
      shareUrl ||
      `${window.location.origin}${window.location.pathname}?share=${plan?.id || 'preview'}`,
    [shareUrl, plan?.id]
  );

  useEffect(() => {
    if (!plan) return;

    let active = true;

    const prepareShare = async () => {
      try {
        const response = await createShareArtifactViaServer({
          planId: plan.id,
          plan,
          profiles: profiles.map((profile) => ({ id: profile.id, name: profile.name })),
          taskState,
        });
        if (active) {
          setShareUrl(response.shareUrl);
        }
      } catch {
        if (active) {
          setShareUrl('');
        }
      }
    };

    void prepareShare();
    return () => {
      active = false;
    };
  }, [plan, profiles, taskState]);

  if (!plan) return null;

  const handleCopySuccess = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 600);
  };

  const readiness = plan.executionReadiness;
  const collaborationMemberIds = new Set(
    plan.collaboration?.members.map((member) => member.id) || []
  );
  const collaborationProfiles = profiles.filter(
    (profile) => profile.id && collaborationMemberIds.has(profile.id)
  );
  const displayProfiles =
    collaborationProfiles.length > 0 ? collaborationProfiles : profiles.slice(0, 2);
  const companionNames = displayProfiles.map((profile) => profile.name).join('、');
  const previewActivities = plan.activities
    .filter((activity) => activity.type !== 'travel')
    .slice(0, 4);
  const taskMeta = getPlannerTaskMeta(taskState?.status);
  const progressText = getPlannerTaskProgressText(
    taskState,
    previewActivities.length || plan.activities.length
  );
  const sharePayload = {
    title: plan.title,
    text: `${plan.summary}\n${previewActivities.map((act) => `${act.timeLine} ${act.title}`).join('\n')}`,
  };
  const shareFullPayload = {
    ...sharePayload,
    text: `${sharePayload.text}\n预算 ¥${plan.totalPrice}\n${plan.durationTags || ''}\n${shareLink}`.trim(),
  };

  const renderDefaultTemplate = () => (
    <div className="app-card rounded-[24px] mb-8 overflow-hidden">
      <div className="p-6 border-b border-[var(--app-border)]">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-[20px] font-bold text-[var(--app-ink)] leading-tight tracking-tight">
              {plan.title}
            </h3>
            <p className="mt-2 text-[13px] font-medium leading-relaxed text-[var(--app-text)]">
              {plan.summary}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[13px] font-bold text-[var(--app-ink)]">
          <div className="app-card-soft rounded-2xl px-3 py-3 text-center">
            <div className="text-[10px] text-[var(--app-text-soft)] mb-1">时长</div>
            {plan.durationTags || '4-6小时'}
          </div>
          <div className="app-card-soft rounded-2xl px-3 py-3 text-center">
            <div className="text-[10px] text-[var(--app-text-soft)] mb-1">预算</div>¥
            {plan.totalPrice}
          </div>
          <div className="app-card-soft rounded-2xl px-3 py-3 text-center">
            <div className="text-[10px] text-[var(--app-text-soft)] mb-1">状态</div>
            {taskMeta.label}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[24px] app-card-soft px-4 py-3">
          <div className="flex -space-x-2">
            {(displayProfiles.length > 0 ? displayProfiles : [{ name: '小明' }])
              .slice(0, 4)
              .map((p, i) => (
                <div
                  key={p.name}
                  className="h-9 w-9 rounded-full border-2 border-white bg-white overflow-hidden shadow-sm"
                >
                  <img src={getAvatarPath(p)} alt={p.name} className="h-full w-full object-cover" />
                </div>
              ))}
          </div>
          <div className="text-[13px] font-bold text-[var(--app-ink)]">
            {displayProfiles.length > 1 ? `${displayProfiles.length} 人同行` : '个人行程'}
          </div>
        </div>

        {standalone && (
          <div className="mt-4 rounded-[24px] app-card-soft px-4 py-4">
            <div className="text-[13px] font-bold text-[var(--app-ink)]">打开后能直接知道什么</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white px-3 py-3 shadow-[0_8px_20px_rgba(20,24,33,0.04)]">
                <div className="text-[10px] font-bold text-[var(--app-text-soft)]">路线</div>
                <div className="mt-1 text-[13px] font-bold text-[var(--app-ink)]">
                  {previewActivities.length} 个点
                </div>
              </div>
              <div className="rounded-2xl bg-white px-3 py-3 shadow-[0_8px_20px_rgba(20,24,33,0.04)]">
                <div className="text-[10px] font-bold text-[var(--app-text-soft)]">当前进度</div>
                <div className="mt-1 text-[13px] font-bold text-[var(--app-ink)]">
                  {progressText}
                </div>
              </div>
              <div className="rounded-2xl bg-white px-3 py-3 shadow-[0_8px_20px_rgba(20,24,33,0.04)]">
                <div className="text-[10px] font-bold text-[var(--app-text-soft)]">适合谁</div>
                <div className="mt-1 text-[13px] font-bold text-[var(--app-ink)]">
                  {displayProfiles.length > 1 ? `${displayProfiles.length} 人同行` : '个人行程'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--mint-ink)]" />
            <span className="text-[13px] font-bold text-[var(--app-ink)]">路线</span>
          </div>
          <div className="text-[11px] font-bold text-[var(--app-text-soft)]">
            {previewActivities.length} 个点
          </div>
        </div>
        <div className="space-y-2.5">
          {previewActivities.map((act, i) => (
            <div
              key={act.title}
              className="flex items-center gap-3 rounded-2xl app-card-soft px-3 py-3 cursor-default"
            >
              <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-[11px] font-bold text-[var(--sky-ink)] shrink-0 shadow-sm">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-[var(--app-ink)]">
                  {act.title}
                </div>
              </div>
              <div className="shrink-0 text-[11px] font-bold text-[var(--sky-ink)]">
                {act.timeLine}
              </div>
            </div>
          ))}
        </div>

        {readiness && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-[24px] app-card-soft px-4 py-4">
              <div className="text-[10px] font-bold text-[var(--app-text-soft)]">当前进度</div>
              <div className="mt-2 text-[13px] font-bold text-[var(--app-ink)]">{progressText}</div>
            </div>
            <div className="rounded-[24px] app-card-soft px-4 py-4">
              <div className="text-[10px] font-bold text-[var(--app-text-soft)]">执行状态</div>
              <div className="mt-2 text-[13px] font-bold text-[var(--app-ink)]">
                {taskMeta.shortLabel}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderReceiptTemplate = () => (
    <div className="mb-8">
      <div className="bg-gradient-to-b from-amber-50 to-amber-100 rounded-[24px] overflow-hidden shadow-lg border border-amber-200">
        <div className="h-3 bg-amber-200 flex items-center justify-center gap-1 px-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="w-2 h-2 bg-[var(--warning-soft)] rounded-full" />
          ))}
        </div>

        <div className="p-6 font-mono text-[var(--app-ink)]">
          <div className="text-center mb-6">
            <div className="text-2xl font-bold tracking-tight text-amber-900 mb-1">TRIP TICKET</div>
            <div className="text-xs text-[var(--warning-ink)] uppercase tracking-widest">
              Travel Itinerary
            </div>
            <div className="mt-4 border-t-2 border-dashed border-amber-300 border-b-2 py-2">
              <div className="text-lg font-bold">{plan.title}</div>
              <div className="text-sm text-amber-700 mt-1">{plan.summary}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--warning-ink)] uppercase tracking-wider">
                Duration
              </span>
              <span className="font-bold">{plan.durationTags || '4-6小时'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--warning-ink)] uppercase tracking-wider">
                Budget
              </span>
              <span className="font-bold text-lg">¥{plan.totalPrice}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--warning-ink)] uppercase tracking-wider">
                Travelers
              </span>
              <span className="font-bold">
                {displayProfiles.length > 1 ? `${displayProfiles.length} people` : 'Solo'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--warning-ink)] uppercase tracking-wider">
                Status
              </span>
              <span className="font-bold text-amber-700">{taskMeta.label}</span>
            </div>
          </div>

          <div className="mt-6 border-t-2 border-dashed border-amber-300 pt-4">
            <div className="text-xs text-[var(--warning-ink)] uppercase tracking-wider mb-3">
              ITINERARY
            </div>
            <div className="space-y-2">
              {previewActivities.map((act, i) => (
                <div key={act.title} className="flex justify-between items-start">
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--warning-ink)] font-bold">
                      {String(i + 1).padStart(2, '0')}.
                    </span>
                    <div>
                      <div className="font-bold">{act.title}</div>
                    </div>
                  </div>
                  <span className="text-sm text-amber-700 font-medium">{act.timeLine}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t-2 border-dashed border-amber-300 pt-4 flex items-center justify-between">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-[var(--warning-soft)]0/20 flex items-center justify-center rotate-[-12deg]">
                <div className="text-[var(--warning-ink)] text-xs font-bold uppercase border-2 border-amber-600 rounded-full w-10 h-10 flex items-center justify-center">
                  Confirmed
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[var(--warning-ink)] uppercase tracking-wider">Date</div>
              <div className="font-bold">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        <div className="h-3 bg-amber-200 flex items-center justify-center gap-1 px-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="w-2 h-2 bg-[var(--warning-soft)] rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );

  const renderPolaroidTemplate = () => (
    <div className="mb-8">
      <div className="bg-white rounded-[8px] shadow-2xl overflow-hidden transform rotate-[-2deg] mx-auto max-w-xs">
        <div className="p-4 pb-16 bg-white">
          <div className="bg-gradient-to-br from-sky-200 via-pink-100 to-amber-100 rounded-[4px] p-4 min-h-[280px] flex flex-col">
            <div className="flex-1 flex flex-col justify-center items-center text-center">
              <div className="text-2xl font-bold text-[var(--app-ink)] mb-2">{plan.title}</div>
              <div className="text-sm text-[var(--app-text)] mb-4">{plan.summary}</div>

              <div className="flex gap-2 mb-4">
                <div className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-sky-700">
                  {plan.durationTags || '4-6h'}
                </div>
                <div className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-pink-700">
                  ¥{plan.totalPrice}
                </div>
              </div>

              <div className="flex -space-x-2">
                {(displayProfiles.length > 0 ? displayProfiles : [{ name: '小明' }])
                  .slice(0, 3)
                  .map((p, i) => (
                    <div
                      key={p.name}
                      className="h-8 w-8 rounded-full border-2 border-white bg-white overflow-hidden shadow-sm"
                    >
                      <img
                        src={getAvatarPath(p)}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
        <div className="pb-4 px-4 bg-white">
          <div className="text-[var(--app-text-soft)] text-xs text-center">
            {previewActivities.map((act) => act.title).join(' • ')}
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotebookTemplate = () => (
    <div className="mb-8">
      <div className="bg-[var(--warning-soft)] rounded-[24px] overflow-hidden shadow-lg border border-amber-200 relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-red-300" />
        <div className="absolute left-10 top-0 bottom-0 w-0.5 bg-blue-200" />

        <div className="p-6 pl-14">
          <div className="text-2xl font-bold text-[var(--app-ink)] mb-1 border-b border-amber-200 pb-2">
            {plan.title}
          </div>
          <div className="text-[var(--app-text)] mb-4">{plan.summary}</div>

          <div className="space-y-1 mb-4">
            <div className="text-sm text-[var(--app-ink)] py-1 border-b border-dashed border-amber-300">
              <span className="text-[var(--app-text-soft)]">• </span>Duration:{' '}
              <span className="font-medium">{plan.durationTags || '4-6 hours'}</span>
            </div>
            <div className="text-sm text-[var(--app-ink)] py-1 border-b border-dashed border-amber-300">
              <span className="text-[var(--app-text-soft)]">• </span>Budget:{' '}
              <span className="font-medium">¥{plan.totalPrice}</span>
            </div>
            <div className="text-sm text-[var(--app-ink)] py-1 border-b border-dashed border-amber-300">
              <span className="text-[var(--app-text-soft)]">• </span>Travelers:{' '}
              <span className="font-medium">
                {displayProfiles.length > 1 ? `${displayProfiles.length} people` : 'Solo'}
              </span>
            </div>
            <div className="text-sm text-[var(--app-ink)] py-1 border-b border-dashed border-amber-300">
              <span className="text-[var(--app-text-soft)]">• </span>Status:{' '}
              <span className="font-medium text-emerald-600">{taskMeta.label}</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-bold text-[var(--app-ink)] mb-2">Plan:</div>
            <div className="space-y-1">
              {previewActivities.map((act, i) => (
                <div
                  key={act.title}
                  className="text-sm text-[var(--app-ink)] py-1 border-b border-dashed border-amber-300 flex justify-between"
                >
                  <span>
                    <span className="text-emerald-600">{i + 1}.</span> {act.title}
                  </span>
                  <span className="text-[var(--app-text)]">{act.timeLine}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="bg-yellow-100 px-4 py-2 rounded rotate-[3deg] border border-yellow-200 shadow-sm">
              <span className="text-sm text-yellow-800 font-medium">Let's go!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTemplateContent = () => {
    switch (selectedTemplate) {
      case 'receipt':
        return renderReceiptTemplate();
      case 'polaroid':
        return renderPolaroidTemplate();
      case 'notebook':
        return renderNotebookTemplate();
      default:
        return renderDefaultTemplate();
    }
  };

  return (
    <motion.div
      className="flex h-full flex-col bg-transparent relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="px-5 pt-14 pb-2 bg-transparent sticky top-0 z-20 flex items-center">
        <button
          onClick={onBack}
          className="app-pill w-10 h-10 flex items-center justify-center rounded-full text-[var(--app-ink)] hover:text-black hover:bg-white transition-all absolute left-4 cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="ml-auto pr-1">
          <button className="app-pill w-10 h-10 flex items-center justify-center rounded-full text-[var(--sky-ink)] cursor-pointer">
            <MapPin className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-32 relative z-10">
        <div>
          <div className="mb-6 mt-2">
            <h2 className="text-[20px] font-bold text-[var(--app-ink)] leading-[1.3] tracking-tight">
              {standalone ? '这是一条可直接查看的行程' : '发给同行人确认'}
            </h2>
            <p className="mt-2 text-[13px] font-bold leading-relaxed text-[var(--app-text)]">
              {standalone
                ? '外部打开也能直接看懂路线、进度和执行状态'
                : companionNames
                  ? `发给 ${companionNames}`
                  : '发出这条安排'}
            </p>
          </div>

          <div className="mb-6">
            <div className="text-[13px] font-bold text-[var(--app-text)] mb-2">选择模板</div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all whitespace-nowrap cursor-pointer ${
                    selectedTemplate === template.id
                      ? `${template.activeBg} shadow-md`
                      : 'border-[var(--app-border)] bg-white text-[var(--app-text)] hover:border-gray-300'
                  }`}
                >
                  {template.icon}
                  <span className="font-bold text-sm">{template.name}</span>
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTemplate}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderTemplateContent()}
            </motion.div>
          </AnimatePresence>

          <div className="grid grid-cols-4 gap-4 px-2 mt-6">
            <button
              onClick={() => {
                shareText(shareFullPayload);
                handleCopySuccess('message');
              }}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div className="w-[52px] h-[52px] bg-white rounded-2xl shadow-[0_8px_18px_rgba(20,24,33,0.05)] flex items-center justify-center mb-2.5 text-[var(--brand-ink)] border border-[var(--app-border)] group-hover:shadow-[0_12px_28px_rgba(255,180,0,0.25)] transition-all">
                <MessageCircle className="w-6 h-6 fill-current" />
              </div>
              <span className="text-[13px] text-[var(--app-text)] font-bold group-hover:text-[var(--brand-ink)] transition-colors">
                发送
              </span>
            </button>

            <button
              onClick={() => {
                copyText(`${shareFullPayload.title}\n${shareFullPayload.text}`);
                handleCopySuccess('copy');
              }}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div className="w-[52px] h-[52px] bg-white rounded-2xl shadow-[0_8px_18px_rgba(20,24,33,0.05)] flex items-center justify-center mb-2.5 text-[var(--brand-ink)] border border-[var(--app-border)] group-hover:shadow-[0_12px_28px_rgba(255,180,0,0.25)] transition-all">
                <Share2 className="w-6 h-6" />
              </div>
              <span className="text-[13px] text-[var(--app-text)] font-bold group-hover:text-[var(--brand-ink)] transition-colors">
                复制文案
              </span>
            </button>

            <button
              onClick={() => {
                downloadSvgPoster(plan.title, [
                  plan.title,
                  plan.summary,
                  ...previewActivities.slice(0, 3).map((act) => `${act.timeLine} ${act.title}`),
                ]);
                handleCopySuccess('download');
              }}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div className="w-[52px] h-[52px] bg-white rounded-2xl shadow-[0_8px_18px_rgba(20,24,33,0.05)] flex items-center justify-center mb-2.5 text-[var(--peach-ink)] border border-[var(--app-border)] group-hover:shadow-[0_12px_28px_rgba(217,139,76,0.25)] transition-all">
                <Download className="w-6 h-6" />
              </div>
              <span className="text-[13px] text-[var(--app-text)] font-bold group-hover:text-[var(--peach-ink)] transition-colors">
                保存海报
              </span>
            </button>

            <button
              onClick={() => onNavigate?.('collaborate')}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div className="w-[52px] h-[52px] bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl shadow-[0_8px_18px_rgba(20,24,33,0.05)] flex items-center justify-center mb-2.5 text-purple-600 border border-purple-200 group-hover:shadow-[0_12px_28px_rgba(139,92,246,0.25)] transition-all">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-[13px] text-[var(--app-text)] font-bold group-hover:text-purple-600 transition-colors">
                协作投票
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/82 backdrop-blur-xl border-t border-[var(--app-border)] flex pb-safe z-30 shadow-[0_-8px_30px_rgba(20,24,33,0.05)]">
        <button
          onClick={onComplete}
          className="app-btn-primary w-full font-bold py-4 rounded-[24px] transition-all text-[15px] tracking-wide cursor-pointer"
        >
          {standalone ? '看完这条安排' : '返回首页'}
        </button>
      </div>
    </motion.div>
  );
}
