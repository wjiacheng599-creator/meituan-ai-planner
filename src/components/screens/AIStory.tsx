import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  Share2,
  Sparkles,
  MapPin,
  Calendar,
  Loader2,
  Smile,
  CheckCircle2,
  Link2,
  MessageCircleMore,
  QrCode,
  Download,
  Copy,
  Palette,
  X,
} from 'lucide-react';
import type { Plan, AIStoryContent } from '../../services/ai';
import { generateAIStory } from '../../services/ai';
import { loadStory, saveStory, loadCheckinRecords } from '../../services/storage';
import {
  createShareArtifactViaServer,
  getStoryViaServer,
  saveStoryViaServer,
} from '../../services/serverApi';
import GradientImg from '../ui/GradientImg';
import { shareText, copyText, downloadSvgPoster } from '../../services/clientActions';
import {
  STORY_TEMPLATES,
  StoryTemplatePreview,
  getStoryTemplateMeta,
  isValidStoryTemplateId,
  type StoryTemplateId,
} from '../story/storyTemplates';

interface AIStoryProps {
  plan: Plan;
  template?: string;
  onBack: () => void;
}

type ShareFeedbackState = 'idle' | 'shared' | 'copied' | 'saved';

function trimStoryParagraph(text: string, maxLength = 86): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;

  const punctuationIndex = normalized.slice(0, maxLength).search(/[。！？]/);
  if (punctuationIndex >= 22) {
    return normalized.slice(0, punctuationIndex + 1);
  }

  return `${normalized.slice(0, maxLength).trim()}…`;
}

function buildMemoryCaption(
  title: string,
  index: number,
  companionText: string,
  template: StoryTemplateId
): string {
  const sharedLines = companionText
    ? [
        `${companionText}在 ${title} 这一站慢慢把状态聊开了，也留下了这次同行最松弛的一刻。`,
        `${title} 这一站节奏刚刚好，和 ${companionText} 待着会自然地想多停一会。`,
        `${companionText}都觉得 ${title} 值得再回头看一眼，气氛和状态都对上了。`,
        `${title} 把这次同行里的轻松感接住了，也让后面的节奏更顺。`,
      ]
    : [
        `${title} 这一站很适合先慢下来，把今天的状态找回来。`,
        `走到 ${title} 的时候，整条路线的节奏刚刚好。`,
        `${title} 留下了一张很想反复翻出来看的画面。`,
        `${title} 像是把这段心情稳稳接住的一站。`,
      ];

  if (template === 'cinema') {
    return `${sharedLines[index % sharedLines.length]} 这一幕很像今天的定格镜头。`;
  }

  if (template === 'magazine') {
    return `${sharedLines[index % sharedLines.length]} 也让这页图文更完整。`;
  }

  return sharedLines[index % sharedLines.length];
}

function buildShareUrl(planId?: string) {
  return `${window.location.origin}${window.location.pathname}?story=${planId || 'preview'}`;
}

function buildShareBody(params: {
  title: string;
  paragraphs: string[];
  activities: Plan['activities'];
  companionText: string;
}) {
  const { title, paragraphs, activities, companionText } = params;
  return [
    `${title}`,
    companionText ? `和 ${companionText} 一起留下的这段回忆。` : '这段路线最后变成了一篇小回忆。',
    ...paragraphs,
    ...activities.slice(0, 4).map((activity, index) => `${index + 1}. ${activity.title}`),
  ].join('\n\n');
}

export default function AIStory({ plan, template = 'diary', onBack }: AIStoryProps) {
  const initialTemplate: StoryTemplateId = isValidStoryTemplateId(template) ? template : 'diary';
  const [activeTemplate, setActiveTemplate] = useState<StoryTemplateId>(initialTemplate);
  const [story, setStory] = useState<AIStoryContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<ShareFeedbackState>('idle');
  const [serverShareUrl, setServerShareUrl] = useState('');
  const [regenerateKey, setRegenerateKey] = useState(0);
  const companionNames =
    plan.collaboration?.members.map((member) => member.name).filter(Boolean) || [];
  const companionText = companionNames.length > 0 ? companionNames.join('、') : '';
  const templateMeta = getStoryTemplateMeta(activeTemplate);

  // 用 ref 保存最新值，避免 useEffect 依赖过多导致频繁重新加载
  const companionTextRef = useRef(companionText);
  companionTextRef.current = companionText;
  const initialTemplateRef = useRef(initialTemplate);
  initialTemplateRef.current = initialTemplate;

  const checkinMap = useMemo(
    () =>
      new Map(
        loadCheckinRecords()
          .filter((record) => record.planId === (plan.id || ''))
          .map((record) => [record.activityId, record])
      ),
    [plan.id]
  );
  const isMinimal = activeTemplate === 'minimal';
  const isDiary = activeTemplate === 'diary';
  const isJournal = activeTemplate === 'journal';
  const isMagazine = activeTemplate === 'magazine';
  const isCinema = activeTemplate === 'cinema';

  const handleRegenerate = async () => {
    setLoading(true);
    setStory(null);
    try {
      const content = await generateAIStory({
        planId: plan.id,
        planTitle: plan.title,
        activities: plan.activities.map((a) => a.title),
        checkInCount: plan.activities.length,
        moodText: companionText ? `同行人：${companionText}` : undefined,
        template: activeTemplate,
      });
      setStory(content);
      saveStory(plan.id || '', {
        ...content,
        template: activeTemplate,
        generatedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch {
      setStory(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const doLoad = async () => {
      if (regenerateKey > 0) {
        // 这是重新生成的请求，直接生成
        await handleRegenerate();
        return;
      }

      if (plan.id) {
        const remoteStory = await getStoryViaServer(plan.id);
        if (remoteStory?.title && remoteStory?.paragraphs) {
          setStory({
            title: remoteStory.title,
            paragraphs: remoteStory.paragraphs,
            highlights: remoteStory.highlights || [],
          });
          if (remoteStory.template && isValidStoryTemplateId(remoteStory.template)) {
            setActiveTemplate(remoteStory.template);
          }
          saveStory(plan.id, remoteStory);
          setLoading(false);
          return;
        }
      }

      const saved = loadStory(plan.id || '');
      if (saved?.title && saved?.paragraphs) {
        setStory({
          title: saved.title,
          paragraphs: saved.paragraphs,
          highlights: saved.highlights || [],
        });
        if (saved.template && isValidStoryTemplateId(saved.template)) {
          setActiveTemplate(saved.template);
        }
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const content = await generateAIStory({
          planId: plan.id,
          planTitle: plan.title,
          activities: plan.activities.map((a) => a.title),
          checkInCount: plan.activities.length,
          moodText: companionTextRef.current ? `同行人：${companionTextRef.current}` : undefined,
          template: initialTemplateRef.current,
        });
        setStory(content);
        saveStory(plan.id || '', {
          ...content,
          template: initialTemplateRef.current,
          generatedAt: Date.now(),
        });
      } catch {
        setStory(null);
      } finally {
        setLoading(false);
      }
    };
    void doLoad();
  }, [plan.id, regenerateKey]);

  useEffect(() => {
    if (!story || !plan.id) return;
    saveStory(plan.id, {
      ...story,
      template: activeTemplate,
    });
    void saveStoryViaServer(plan.id, {
      ...story,
      template: activeTemplate,
    });
  }, [activeTemplate, story, plan.id]);

  useEffect(() => {
    if (shareFeedback === 'idle') return;
    const timer = window.setTimeout(() => setShareFeedback('idle'), 1800);
    return () => window.clearTimeout(timer);
  }, [shareFeedback]);

  const storyTitle = story?.title || plan.title;
  const baseParagraphs = story?.paragraphs || [
    companionText
      ? `和${companionText}一起走完「${plan.title}」之后，会发现这条路线不只是顺路，更像一段被认真拼起来的小回忆。`
      : `这次「${plan.title}」走下来，节奏比想象中更舒服，也比预期留下了更多画面感。`,
    companionText
      ? `从第一站到最后一站，${companionText}都能在同一条路线里找到各自喜欢的片刻，所以这次同行没有谁在迁就谁。`
      : '从第一站到最后一站，每个停留点都刚好接住了当下的心情，走起来几乎没有断开的感觉。',
    companionText
      ? `那些边走边聊、顺手拍下来的瞬间，让这次同行不只是“完成了一条路线”，更像一起过了一段会被反复提起的下午。`
      : '那些边走边停、顺手拍下来的瞬间，也让这条路线不只是打卡完成，而是真的留下了值得回看的片段。',
  ];

  const storyParagraphs = baseParagraphs
    .slice(0, 3)
    .map((para, index) => trimStoryParagraph(para, index === 0 ? 96 : 88));

  const storyHighlights = story?.highlights?.length
    ? story.highlights
    : [
        { icon: 'footprints', label: '足迹', value: `${plan.activities.length} 个地点` },
        { icon: 'heart', label: '快乐指数', value: companionText ? '一起刚刚好' : '98%' },
        { icon: 'star', label: '最佳时刻', value: companionText ? '同行的每一站' : '每一刻' },
        { icon: 'camera', label: '精选瞬间', value: '全程精彩' },
      ];

  const storyBlocks = Array.from(
    { length: Math.max(storyParagraphs.length, plan.activities.length) },
    (_, index) => ({
      paragraph: storyParagraphs[index],
      activity: plan.activities[index],
      index,
    })
  );

  useEffect(() => {
    let active = true;

    const prepareShare = async () => {
      try {
        const response = await createShareArtifactViaServer({
          planId: plan.id,
          plan,
          profiles:
            companionNames.length > 0
              ? companionNames.map((name, index) => ({ id: String(index), name }))
              : [],
        });
        if (active) {
          setServerShareUrl(response.shareUrl);
        }
      } catch {
        if (active) {
          setServerShareUrl('');
        }
      }
    };

    void prepareShare();

    return () => {
      active = false;
    };
  }, [plan, companionNames]);

  const shareUrl = useMemo(
    () => serverShareUrl || buildShareUrl(plan.id),
    [serverShareUrl, plan.id]
  );
  const shareBody = useMemo(
    () =>
      buildShareBody({
        title: storyTitle,
        paragraphs: storyParagraphs,
        activities: plan.activities,
        companionText,
      }),
    [storyTitle, storyParagraphs, plan.activities, companionText]
  );

  const handleNativeShare = async () => {
    const usedNativeShare =
      typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const success = await shareText({
      title: storyTitle,
      text: shareBody,
      url: shareUrl,
    });
    if (!success) return;
    setShareFeedback(usedNativeShare ? 'shared' : 'copied');
    setShowSharePanel(false);
  };

  const handleCopyLink = async () => {
    const success = await copyText(shareUrl);
    if (!success) return;
    setShareFeedback('copied');
    setShowSharePanel(false);
  };

  const handleCopyStory = async () => {
    const success = await copyText(`${storyTitle}\n\n${shareBody}`);
    if (!success) return;
    setShareFeedback('copied');
    setShowSharePanel(false);
  };

  const handleSavePoster = () => {
    downloadSvgPoster(`${storyTitle}-AI-STORY`, [
      storyTitle,
      companionText ? `同行人：${companionText}` : '本次回忆',
      ...storyParagraphs.slice(0, 2),
    ]);
    setShareFeedback('saved');
    setShowSharePanel(false);
  };

  const renderShareAction = (icon: ReactNode, label: string, hint: string, onClick: () => void) => (
    <button
      onClick={onClick}
      className="rounded-[24px] border border-[var(--app-border)] bg-white p-4 text-left shadow-[0_6px_18px_rgba(15,23,42,0.05)] active:scale-[0.98]"
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--app-card-soft)] text-[var(--app-ink)]">
        {icon}
      </div>
      <div className="text-[13px] font-bold text-[var(--app-ink)]">{label}</div>
      <div className="mt-1 text-[11px] font-bold leading-[1.5] text-[var(--app-text)]">{hint}</div>
    </button>
  );

  const fallbackGradient = isJournal
    ? 'gradient:pink-yellow'
    : isMagazine
      ? 'gradient:green-teal'
      : isCinema
        ? 'gradient:blue-indigo'
        : isMinimal
          ? 'gradient:indigo-blue'
          : 'gradient:orange-amber';

  const renderActivityMedia = (
    activity: Plan['activities'][number],
    className: string,
    imageClassName = '',
    gradientOverride?: string
  ) => (
    <GradientImg
      src={
        checkinMap.get(activity.id)?.photoDataUrl ||
        activity.imageUrl ||
        gradientOverride ||
        fallbackGradient
      }
      className={`${className} ${imageClassName}`.trim()}
      alt={activity.title}
    />
  );

  const renderParagraphBlock = (paragraph: string, index: number) => {
    if (isMinimal) {
      return (
        <div className="rounded-[24px] border border-[#edf1f6] bg-white/96 px-6 py-6 shadow-[0_14px_30px_rgba(148,163,184,0.08)]">
          {index === 0 && (
            <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-[#9aa7b7]">
              Postcard Notes
            </div>
          )}
          <p className="text-[18px] font-medium leading-[2] tracking-[0.01em] text-[var(--app-ink)]">
            {index === 0 ? (
              <>
                <span className="mr-1.5 text-[40px] font-bold leading-none text-[var(--app-ink)]">
                  {paragraph.slice(0, 1)}
                </span>
                {paragraph.slice(1)}
              </>
            ) : (
              paragraph
            )}
          </p>
        </div>
      );
    }

    if (isDiary) {
      return (
        <div className="relative mx-auto max-w-[350px] rounded-[30px] border border-[#efe1bf] bg-[#fffdf6] px-5 py-5 shadow-[0_14px_34px_rgba(217,139,76,0.10)]">
          <div className="absolute left-5 top-4 h-5 w-16 rounded-full bg-[var(--brand-soft)]/80" />
          <div className="absolute right-5 top-2 text-[28px] font-bold text-[#e2c56d]">"</div>
          <p
            className={`font-serif text-[18px] leading-[1.95] text-[#5b4c37] ${index === 0 ? 'indent-6' : ''}`}
          >
            {paragraph}
          </p>
        </div>
      );
    }

    if (isJournal) {
      return (
        <div className="relative rounded-[30px] border-2 border-[var(--rose-strong)] bg-white px-5 py-5 shadow-[0_14px_30px_rgba(201,75,134,0.10)]">
          <div className="absolute -top-3 left-5 rotate-[-7deg] rounded-full bg-[var(--rose-ink)] px-3 py-1 text-[10px] font-bold text-white shadow-sm">
            心情贴纸
          </div>
          <div className="absolute right-4 top-4 h-6 w-6 rounded-full bg-[var(--peach-soft)] shadow-sm" />
          <p className="text-[15px] font-medium leading-[1.95] tracking-[0.01em] text-[#6a5562]">
            {paragraph}
          </p>
        </div>
      );
    }

    if (isMagazine) {
      return (
        <div className="overflow-hidden rounded-[30px] border border-[#d6e2d8] bg-[#fbfcf8] shadow-[0_14px_34px_rgba(42,162,122,0.08)]">
          <div className="grid grid-cols-[92px_1fr]">
            <div className="flex flex-col justify-between bg-[#26352d] px-4 py-5 text-white">
              <span className="text-[10px] font-bold uppercase tracking-[0.26em] text-white/60">
                Essay
              </span>
              <span className="text-[22px] font-bold leading-none">0{index + 1}</span>
            </div>
            <div className="px-5 py-5">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#90a998]">
                Editorial Memory
              </div>
              <p className="text-[18px] font-semibold leading-[1.85] tracking-[-0.01em] text-[#202820]">
                {paragraph}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#151b28] px-5 py-5 shadow-[0_18px_38px_rgba(17,24,39,0.26)]">
        <div className="mb-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
          <span>Scene {index + 1}</span>
          <span>Memory Cut</span>
        </div>
        <p className="text-[18px] font-medium leading-[1.95] text-white/88">{paragraph}</p>
      </div>
    );
  };

  const renderHighlightsBlock = () => {
    if (isMagazine) {
      return (
        <div className="space-y-2.5">
          {storyHighlights.map((highlight, idx) => (
            <motion.div
              key={highlight.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + idx * 0.06 }}
              className="grid grid-cols-[54px_1fr_auto] items-center gap-3 rounded-[24px] border border-[#d6e2d8] bg-[#fbfcf8] px-4 py-4 shadow-[0_10px_24px_rgba(42,162,122,0.06)]"
            >
              <div className="text-[20px] font-bold leading-none text-[#d1ddd0]">0{idx + 1}</div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#90a998]">
                  {highlight.label}
                </div>
                <div className="mt-1 text-[15px] font-bold text-[#223024]">{highlight.value}</div>
              </div>
              <div className="h-8 w-8 rounded-full border border-[#dce8dd] bg-white" />
            </motion.div>
          ))}
        </div>
      );
    }

    if (isCinema) {
      return (
        <div className="grid grid-cols-2 gap-3">
          {storyHighlights.map((highlight, idx) => (
            <motion.div
              key={highlight.label}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + idx * 0.06 }}
              className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4 shadow-[0_12px_26px_rgba(17,24,39,0.18)] backdrop-blur-md"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                {highlight.label}
              </div>
              <div className="mt-2 text-[15px] font-bold leading-[1.4] text-white">
                {highlight.value}
              </div>
            </motion.div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-3">
        {storyHighlights.map((highlight, idx) => (
          <motion.div
            key={highlight.label}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + idx * 0.06 }}
            className={`p-4 rounded-[24px] ${
              isMinimal
                ? 'bg-[var(--app-card-soft)]'
                : isJournal
                  ? 'bg-white border-2 border-[var(--rose-strong)]'
                  : 'bg-white border border-[var(--brand-soft)]'
            } ${isDiary ? `rotate-[${idx % 2 === 0 ? '-1deg' : '1deg'}]` : ''}`}
          >
            <div className="mb-1 text-[11px] font-bold text-[var(--app-text-soft)]">
              {highlight.label}
            </div>
            <div className="text-[15px] font-bold leading-[1.4] text-[var(--app-ink)]">
              {highlight.value}
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  const renderActivityBlock = (activity: Plan['activities'][number], index: number) => {
    const startTime = (activity.timeLine ?? '').split('-')[0]?.trim() || activity.timeLine;
    const caption = buildMemoryCaption(activity.title, index, companionText, activeTemplate);

    if (isMinimal) {
      return (
        <motion.div
          initial={{ y: 26, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-50px' }}
          className="overflow-hidden rounded-[30px] border border-[#edf1f6] bg-white p-4 shadow-[0_14px_32px_rgba(148,163,184,0.08)]"
        >
          <div className="overflow-hidden rounded-[24px] bg-[#f3f6fa] aspect-[4/3]">
            {renderActivityMedia(activity, 'h-full w-full object-cover')}
          </div>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#a1aebe]">
                Stop {index + 1}
              </div>
              <p className="mt-2 text-[22px] font-bold leading-tight tracking-[-0.03em] text-[var(--app-ink)]">
                {activity.title}
              </p>
            </div>
            <div className="rounded-full bg-[#f5f8fb] px-3 py-1.5 text-[11px] font-bold text-[#8292a4]">
              {startTime}
            </div>
          </div>
          <p className="mt-3 text-[13px] font-medium leading-[1.9] text-[var(--app-text)]">
            {caption}
          </p>
        </motion.div>
      );
    }

    if (isDiary) {
      return (
        <motion.div
          initial={{ rotate: index % 2 === 0 ? -2 : 2, y: 26, opacity: 0 }}
          whileInView={{ rotate: index % 2 === 0 ? -2 : 2, y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-50px' }}
          className="relative mx-auto max-w-[320px] rounded-[8px] border border-[#f2e6cb] bg-white p-3 pb-6 shadow-[0_18px_38px_rgba(181,144,82,0.12)]"
        >
          <div className="absolute -top-3 left-1/2 h-7 w-24 -translate-x-1/2 rotate-[-4deg] rounded-[8px] bg-[rgba(255,240,199,0.9)] shadow-sm" />
          <div className="overflow-hidden rounded-[6px] border border-[#f1e6cf] bg-[#faf6eb] aspect-square">
            {renderActivityMedia(activity, 'h-full w-full object-cover', 'grayscale-[8%]')}
          </div>
          <div className="mt-4 px-2 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#b79a58]">
              {startTime}
            </div>
            <p className="mt-2 font-serif text-[22px] font-bold leading-tight text-[#4c3f2d]">
              {activity.title}
            </p>
            <p className="mt-2 text-[13px] leading-[1.85] text-[#7c6950]">{caption}</p>
          </div>
        </motion.div>
      );
    }

    if (isJournal) {
      return (
        <motion.div
          initial={{ rotate: index % 2 === 0 ? -2 : 2, y: 26, opacity: 0 }}
          whileInView={{ rotate: index % 2 === 0 ? -2 : 2, y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-50px' }}
          className="relative mx-auto max-w-[340px] rounded-[30px] border-2 border-[var(--rose-strong)] bg-[#fffafd] p-4 shadow-[0_18px_36px_rgba(201,75,134,0.10)]"
        >
          <div className="absolute -top-3 left-5 rotate-[-8deg] rounded-full bg-[var(--rose-ink)] px-3 py-1 text-[10px] font-bold text-white shadow-sm">
            #{index + 1}
          </div>
          <div className="grid grid-cols-[1.08fr_0.92fr] gap-3">
            <div className="overflow-hidden rounded-[24px] border-2 border-white bg-white shadow-sm aspect-[3/4]">
              {renderActivityMedia(activity, 'h-full w-full object-cover')}
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <div className="rounded-2xl bg-[var(--peach-soft)] px-3 py-3 text-[11px] font-bold text-[var(--peach-ink)]">
                {startTime}
              </div>
              <div className="rounded-2xl bg-white px-3 py-3 shadow-[0_10px_22px_rgba(201,75,134,0.08)]">
                <div className="text-[13px] font-bold leading-snug text-[#5e4452]">
                  {activity.title}
                </div>
              </div>
              <div className="rounded-full bg-[var(--rose-soft)] px-3 py-2 text-[10px] font-bold text-[var(--rose-ink)]">
                今日亮点
              </div>
            </div>
          </div>
          <p className="mt-4 px-1 text-[13px] leading-[1.85] text-[#725d6b]">{caption}</p>
        </motion.div>
      );
    }

    if (isMagazine) {
      const reverse = index % 2 === 1;

      return (
        <motion.div
          initial={{ y: 26, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-50px' }}
          className="overflow-hidden rounded-[24px] border border-[#d6e2d8] bg-[#fbfcf8] p-4 shadow-[0_18px_36px_rgba(42,162,122,0.08)]"
        >
          <div className="grid grid-cols-[1.05fr_0.95fr] items-stretch gap-4">
            <div className={reverse ? 'order-2' : ''}>
              <div className="overflow-hidden rounded-[24px] bg-[#ecf4ef] aspect-[4/5]">
                {renderActivityMedia(activity, 'h-full w-full object-cover')}
              </div>
            </div>
            <div className={`flex flex-col justify-between ${reverse ? 'order-1' : ''}`}>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8aa492]">
                  Feature {index + 1}
                </div>
                <p className="mt-2 text-[20px] font-bold leading-[1.04] tracking-[-0.03em] text-[#203024]">
                  {activity.title}
                </p>
              </div>
              <div className="my-4 h-px bg-[linear-gradient(90deg,#d7e4d9,transparent)]" />
              <div className="rounded-[24px] bg-white px-4 py-4 shadow-[0_12px_24px_rgba(42,162,122,0.05)]">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#90a998]">
                  {startTime}
                </div>
                <p className="text-[13px] leading-[1.85] text-[#58675b]">{caption}</p>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ y: 26, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: '-50px' }}
        className="overflow-hidden rounded-[30px] border border-white/10 bg-[#131925] shadow-[0_18px_38px_rgba(17,24,39,0.26)]"
      >
        <div className="relative aspect-[4/5] overflow-hidden">
          {renderActivityMedia(
            activity,
            'h-full w-full object-cover',
            'brightness-[0.88] contrast-[1.04]'
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/28 to-transparent" />
          <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/72 backdrop-blur-md">
            {startTime}
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/58">
              Scene {index + 1}
            </div>
            <p className="text-[26px] font-bold leading-[1.04] tracking-[-0.04em] text-white">
              {activity.title}
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] leading-[1.9] text-white/74">{caption}</p>
        </div>
      </motion.div>
    );
  };

  const renderHero = () => {
    if (isMinimal) {
      return (
        <div className="mb-7 rounded-[24px] border border-[#edf1f6] bg-white/96 px-6 py-6 shadow-[0_18px_36px_rgba(148,163,184,0.08)]">
          <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#9aa7b7]">
            Postcard Edition
          </div>
          <h2 className="mt-4 text-[32px] font-bold leading-[1.04] tracking-[-0.05em] text-[var(--app-ink)]">
            {storyTitle}
          </h2>
          <div className="mt-5 flex items-center gap-3 text-[13px] font-bold text-[#7f90a2]">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-[#8ea0b5]" />{' '}
              {new Date()
                .toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
                .replace(/\//g, '.')}
            </span>
            <span className="h-1 w-1 rounded-full bg-[#ccd5e2]" />
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[#8ea0b5]" /> {plan.activities.length} 个足迹
            </span>
          </div>
          <p className="mt-5 max-w-[300px] text-[13px] leading-[1.9] text-[var(--app-text)]">
            {storyParagraphs[0]}
          </p>
        </div>
      );
    }

    if (isDiary) {
      return (
        <div className="relative mb-7 rounded-[36px] border border-[#efe1bf] bg-[linear-gradient(180deg,#fffef8_0%,#fff9ee_100%)] px-6 py-6 shadow-[0_20px_40px_rgba(217,139,76,0.10)]">
          <div className="absolute right-6 top-5 rotate-[8deg] rounded-full bg-[#fff3cf] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b9974c]">
            Day Note
          </div>
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.28em] text-[#c3aa69]">
            今日回忆
          </div>
          <h2 className="max-w-[260px] font-serif text-[31px] font-bold leading-[1.12] tracking-[-0.03em] text-[#4b3d2c]">
            {storyTitle}
          </h2>
          <div className="mt-5 flex items-center gap-3 text-[13px] font-bold text-[#987d4f]">
            <span>
              {new Date()
                .toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
                .replace(/\//g, '.')}
            </span>
            <span className="h-1 w-1 rounded-full bg-[#d8c18c]" />
            <span>{plan.activities.length} 个片段</span>
          </div>
          <div className="mt-6 grid grid-cols-[1fr_92px] gap-3">
            <div className="rounded-[24px] bg-white/90 px-4 py-4 shadow-[0_12px_24px_rgba(217,139,76,0.08)]">
              <p className="text-[13px] leading-[1.9] text-[#7c6950]">{storyParagraphs[0]}</p>
            </div>
            <div className="rounded-[24px] bg-[linear-gradient(180deg,#ffe8b5_0%,#ffd18b_100%)]" />
          </div>
        </div>
      );
    }

    if (isJournal) {
      return (
        <div className="relative mb-7 rounded-[36px] border-2 border-[var(--rose-strong)] bg-[linear-gradient(180deg,#fffafd_0%,#fff4f8_100%)] px-6 py-6 shadow-[0_20px_40px_rgba(201,75,134,0.10)]">
          <div className="absolute -top-3 left-5 rotate-[-8deg] rounded-full bg-[var(--rose-ink)] px-3 py-1 text-[10px] font-bold text-white shadow-sm">
            今天超值得记
          </div>
          <div className="absolute right-5 top-5 h-12 w-12 rounded-full bg-[var(--peach-soft)]" />
          <div className="mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--rose-ink)]">
            <Sparkles className="h-4 w-4" />
            Fun Scrapbook
          </div>
          <h2 className="mt-4 max-w-[270px] text-[30px] font-bold leading-[1.08] tracking-[-0.05em] text-[#5d4452]">
            {storyTitle}
          </h2>
          <div className="mt-5 grid grid-cols-[1.05fr_0.95fr] gap-3">
            <div className="rounded-[24px] bg-white px-4 py-4 shadow-[0_12px_22px_rgba(201,75,134,0.08)]">
              <p className="text-[13px] leading-[1.9] text-[#725d6b]">{storyParagraphs[0]}</p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="rounded-[24px] bg-[var(--rose-soft)] px-4 py-3 text-[11px] font-bold text-[var(--rose-ink)]">
                {plan.activities.length} 个足迹
              </div>
              <div className="rounded-[24px] bg-[var(--peach-soft)] px-4 py-3 text-[11px] font-bold text-[var(--peach-ink)]">
                {new Date()
                  .toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
                  .replace(/\//g, '.')}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isMagazine) {
      return (
        <div className="mb-7 overflow-hidden rounded-[38px] border border-[#d6e2d8] bg-[#fbfcf8] shadow-[0_22px_44px_rgba(42,162,122,0.08)]">
          <div className="grid grid-cols-[96px_1fr]">
            <div className="flex flex-col justify-between bg-[#24342d] px-5 py-6 text-white">
              <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/48">
                Cover
              </span>
              <span className="text-[34px] font-bold leading-none">01</span>
            </div>
            <div className="px-6 py-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#8aa492]">
                Weekend Editorial
              </div>
              <h2 className="mt-3 max-w-[260px] text-[34px] font-bold leading-[0.98] tracking-[-0.06em] text-[#203024]">
                {storyTitle}
              </h2>
              <div className="mt-5 grid grid-cols-[1fr_110px] gap-3">
                <div className="rounded-[24px] bg-white px-4 py-4 shadow-[0_12px_24px_rgba(42,162,122,0.06)]">
                  <p className="text-[13px] leading-[1.9] text-[#58675b]">{storyParagraphs[0]}</p>
                </div>
                <div className="rounded-[24px] bg-[linear-gradient(180deg,#d6ebe0_0%,#c4dfd2_100%)]" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="relative mb-7 overflow-hidden rounded-[38px] border border-white/10 bg-[#141b27] shadow-[0_24px_46px_rgba(17,24,39,0.30)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(159,180,208,0.26),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
        <div className="relative px-6 py-6">
          <div className="mb-12 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.3em] text-white/42">
            <span>Official Poster</span>
            <span>
              {new Date()
                .toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
                .replace(/\//g, '.')}
            </span>
          </div>
          <div className="max-w-[280px]">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.28em] text-white/48">
              Starring Today
            </div>
            <h2 className="text-[38px] font-bold leading-[0.96] tracking-[-0.07em] text-white">
              {storyTitle}
            </h2>
          </div>
          <div className="mt-8 grid grid-cols-[1fr_108px] gap-3">
            <div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-md">
              <p className="text-[13px] leading-[1.9] text-white/76">{storyParagraphs[0]}</p>
            </div>
            <div className="rounded-[24px] bg-[linear-gradient(180deg,#d9e2ef_0%,#a5b8d2_100%)]" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex h-full flex-col relative overflow-hidden ${
        isMinimal
          ? 'bg-white'
          : isDiary
            ? 'bg-[#fcf8ef]'
            : isJournal
              ? 'bg-[#fff7fb]'
              : isMagazine
                ? 'bg-[#f8fbf8]'
                : 'bg-[#101621]'
      }`}
    >
      {!isMinimal && (
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: isDiary
              ? 'linear-gradient(0deg, rgba(207,182,124,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(207,182,124,0.04) 1px, transparent 1px)'
              : isJournal
                ? 'linear-gradient(45deg, rgba(201,75,134,0.08) 25%, transparent 25%, transparent 75%, rgba(201,75,134,0.08) 75%), linear-gradient(45deg, rgba(201,75,134,0.08) 25%, transparent 25%, transparent 75%, rgba(201,75,134,0.08) 75%)'
                : isCinema
                  ? 'radial-gradient(circle at 20% 20%, rgba(129,146,171,0.18), transparent 30%), radial-gradient(circle at 80% 10%, rgba(255,216,77,0.08), transparent 22%)'
                  : 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.1) 1px, transparent 0)',
            backgroundSize: isDiary ? '22px 22px' : isJournal ? '20px 20px' : '16px 16px',
            backgroundPosition: isJournal ? '0 0, 10px 10px' : '0 0',
          }}
        />
      )}

      <div className="px-5 pt-14 pb-2 bg-transparent sticky top-0 z-20 flex items-center justify-between">
        <button
          onClick={onBack}
          className={`w-10 h-10 flex items-center justify-center rounded-full shadow-sm backdrop-blur-md transition-all ${
            isCinema
              ? 'bg-white/8 border border-white/10 text-white hover:bg-white/12'
              : 'bg-white/65 border border-[var(--app-border)] text-[var(--app-ink)] hover:text-black hover:bg-white'
          }`}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span
          className={`text-[15px] font-bold tracking-[0.18em] font-serif opacity-80 ${isCinema ? 'text-white' : 'text-[var(--app-ink)]'}`}
        >
          AI STORY
        </span>
        <button
          onClick={() => setShowSharePanel(true)}
          className={`w-10 h-10 flex items-center justify-center rounded-full shadow-sm backdrop-blur-md transition-all ${
            isCinema
              ? 'bg-white/8 border border-white/10 text-white hover:bg-white/12'
              : 'bg-white/65 border border-[var(--app-border)] text-[var(--app-ink)] hover:text-black hover:bg-white'
          }`}
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-24 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="w-10 h-10 text-[var(--brand-ink)] animate-spin" />
            <p className="text-[var(--app-text)] font-bold text-[13px]">
              AI 正在为你撰写旅行回忆录...
            </p>
            <p className="text-[var(--app-text-soft)] text-[13px]">
              根据你的出行信息生成个性化内容
            </p>
          </div>
        ) : (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            {renderHero()}

            <div
              className={`mb-6 flex gap-2 flex-wrap ${isMagazine ? 'justify-start' : 'justify-center'}`}
            >
              {companionText && (
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm border ${
                    isCinema
                      ? 'border-white/10 bg-white/8 text-white/76'
                      : 'border-[var(--app-border)] bg-white/80 text-[var(--app-text)]'
                  }`}
                >
                  <Smile
                    className={`w-3.5 h-3.5 ${isCinema ? 'text-white/70' : 'text-[var(--brand-ink)]'}`}
                  />
                  和 {companionText} 一起
                </div>
              )}
              <button
                onClick={() => setShowTemplateModal(true)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm border active:scale-[0.98] ${
                  isCinema
                    ? 'border-white/10 bg-white/8 text-white'
                    : 'border-[var(--app-border)] bg-white/80 text-[var(--app-ink)]'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                切换模板
              </button>
              <button
                onClick={() => {
                  setRegenerateKey((k) => k + 1);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm border active:scale-[0.98] ${
                  isCinema
                    ? 'border-white/10 bg-[var(--rose-soft)] text-[var(--rose-ink)]'
                    : 'border-[var(--rose-strong)] bg-[var(--rose-soft)] text-[var(--rose-ink)]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                重新生成
              </button>
              {shareFeedback !== 'idle' && (
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm ${
                    isCinema ? 'bg-white text-[#111827]' : 'bg-[var(--app-ink)] text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {shareFeedback === 'shared'
                    ? '已调起分享'
                    : shareFeedback === 'saved'
                      ? '已保存海报'
                      : '已完成复制'}
                </div>
              )}
            </div>

            <div className="space-y-5">
              {storyBlocks.map(({ paragraph, activity, index }) => (
                <div key={index} className="space-y-3.5">
                  {paragraph && (
                    <div
                      className={`px-5 py-5 relative ${isMinimal ? 'bg-[var(--app-card-soft)] rounded-[24px]' : isJournal ? 'bg-white rounded-[24px] shadow-[8px_8px_0px_#ffd7e8] border-2 border-[var(--rose-strong)]' : isMagazine ? 'bg-white rounded-[24px] border border-[var(--mint-strong)] shadow-[0_10px_26px_rgba(42,162,122,0.06)]' : isCinema ? 'bg-white rounded-[24px] border border-[var(--sky-strong)] shadow-[0_10px_28px_rgba(107,125,152,0.08)]' : 'bg-white rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-[var(--brand-soft)]'}`}
                    >
                      {index === 0 && (
                        <div className="absolute -top-3 -left-2">
                          <Sparkles className={`w-6 h-6 ${templateMeta.accent}`} />
                        </div>
                      )}
                      <p
                        className={`text-[15px] leading-[1.88] font-medium ${index === 0 ? 'indent-8' : ''} ${isMinimal ? 'text-[var(--app-ink)] tracking-wide' : 'text-[var(--app-ink)]'}`}
                      >
                        {paragraph}
                      </p>
                    </div>
                  )}

                  {index === 0 && renderHighlightsBlock()}

                  {activity && renderActivityBlock(activity, index)}
                </div>
              ))}
            </div>

            <div className="mt-14 mb-8 flex justify-center opacity-40">
              <span
                className={`text-[11px] font-bold tracking-[0.2em] uppercase ${isCinema ? 'text-white/42' : 'text-[var(--app-text)]'}`}
              >
                AI Studio Memories
              </span>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showTemplateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              className="relative flex max-h-[82vh] w-full flex-col rounded-t-[32px] bg-white p-6 pb-8 shadow-2xl"
            >
              <button
                onClick={() => setShowTemplateModal(false)}
                className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center bg-[var(--app-card-soft)] rounded-full text-[var(--app-text)]"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="mb-2 flex items-center gap-2 text-[20px] font-bold text-[var(--app-ink)]">
                <Palette className="w-5 h-5 text-[var(--app-ink)]" />
                选择回忆录模板
              </h3>
              <p className="mb-5 pr-8 text-[13px] font-bold leading-relaxed text-[var(--app-text)]">
                不同模板会切换排版、节奏和情绪感，方便你挑到更适合这次行程的表达方式。
              </p>
              <div className="grid max-h-[54vh] grid-cols-2 gap-4 overflow-y-auto pr-1">
                {STORY_TEMPLATES.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTemplate(item.id)}
                    className="text-left active:scale-[0.99] transition-transform"
                  >
                    <StoryTemplatePreview
                      templateId={item.id}
                      selected={activeTemplate === item.id}
                      compact
                    />
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="mt-auto w-full rounded-[24px] bg-[var(--app-ink)] py-4 text-[15px] font-bold text-white shadow-lg transition-all"
              >
                使用这个模板
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSharePanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end"
            onClick={() => setShowSharePanel(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="bg-white w-full rounded-t-[32px] p-6 pb-10 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-[20px] font-bold text-[var(--app-ink)]">分享这篇回忆</div>
                  <div className="mt-1 text-[13px] font-bold text-[var(--app-text)]">
                    优先展示当前模板，保留完整故事内容
                  </div>
                </div>
                <button
                  onClick={() => setShowSharePanel(false)}
                  className="w-9 h-9 rounded-full bg-[var(--app-card-soft)] flex items-center justify-center text-[var(--app-text)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {renderShareAction(
                  <Share2 className="w-5 h-5" />,
                  '系统分享',
                  '优先调起系统分享面板',
                  () => void handleNativeShare()
                )}
                {renderShareAction(
                  <Link2 className="w-5 h-5" />,
                  '复制短链',
                  '先复制当前故事链接',
                  () => void handleCopyLink()
                )}
                {renderShareAction(
                  <Copy className="w-5 h-5" />,
                  '复制文案',
                  '适合发到微信或备忘录',
                  () => void handleCopyStory()
                )}
                {renderShareAction(
                  <Download className="w-5 h-5" />,
                  '保存海报',
                  '把当前故事导出成海报',
                  handleSavePoster
                )}
                {renderShareAction(
                  <MessageCircleMore className="w-5 h-5" />,
                  '发微信 / QQ',
                  '复制后可直接发送到聊天',
                  () => void handleCopyStory()
                )}
                {renderShareAction(
                  <QrCode className="w-5 h-5" />,
                  '二维码入口',
                  '当前先复制链接，后续可接二维码',
                  () => void handleCopyLink()
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
