import { BookOpenText, Film, NotebookPen, PanelsTopLeft, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type StoryTemplateId = 'diary' | 'minimal' | 'journal' | 'magazine' | 'cinema';

export interface StoryTemplateMeta {
  id: StoryTemplateId;
  name: string;
  desc: string;
  accent: string;
  icon: LucideIcon;
  coverGradient: string;
  previewTone: string;
}

export const STORY_TEMPLATES: StoryTemplateMeta[] = [
  {
    id: 'diary',
    name: '文艺日记',
    desc: '胶片感与手写标题',
    accent: 'text-[var(--brand-ink)]',
    icon: BookOpenText,
    coverGradient: 'from-[var(--brand-soft)] via-[#ffe59b] to-[var(--peach-soft)]',
    previewTone: 'bg-[#fff8ec]',
  },
  {
    id: 'minimal',
    name: '极简明信片',
    desc: '留白更大，信息更克制',
    accent: 'text-slate-700',
    icon: PanelsTopLeft,
    coverGradient: 'from-[#DBEAFE] via-[#BFDBFE] to-[#93C5FD]',
    previewTone: 'bg-white',
  },
  {
    id: 'journal',
    name: '活泼手账',
    desc: '贴纸感与轻松氛围',
    accent: 'text-[var(--rose-ink)]',
    icon: Sparkles,
    coverGradient: 'from-[var(--rose-soft)] via-[#ffd5e7] to-[var(--peach-soft)]',
    previewTone: 'bg-[#FFF7FB]',
  },
  {
    id: 'magazine',
    name: '旅行杂志',
    desc: '图文并置，更像 editorial',
    accent: 'text-[var(--mint-ink)]',
    icon: NotebookPen,
    coverGradient: 'from-[var(--mint-soft)] via-[#dff1e8] to-[var(--sky-soft)]',
    previewTone: 'bg-[#F4FBF7]',
  },
  {
    id: 'cinema',
    name: '电影海报',
    desc: '大图主导，更有情绪感',
    accent: 'text-[var(--sky-ink)]',
    icon: Film,
    coverGradient: 'from-[#e5eaf5] via-[#d8e1ef] to-[#c9d5e8]',
    previewTone: 'bg-[#f4f7fb]',
  },
];

export function getStoryTemplateMeta(templateId: string): StoryTemplateMeta {
  return STORY_TEMPLATES.find((template) => template.id === templateId) || STORY_TEMPLATES[0];
}

const VALID_TEMPLATE_IDS: ReadonlySet<string> = new Set(STORY_TEMPLATES.map((t) => t.id));

export function isValidStoryTemplateId(value: string): value is StoryTemplateId {
  return VALID_TEMPLATE_IDS.has(value);
}

export function StoryTemplatePreview({
  templateId,
  selected = false,
  compact = false,
}: {
  templateId: StoryTemplateId;
  selected?: boolean;
  compact?: boolean;
}) {
  const template = getStoryTemplateMeta(templateId);
  const Icon = template.icon;
  const iconSize = compact ? 'h-7 w-7 rounded-[16px]' : 'h-8 w-8 rounded-2xl';
  const previewHeight = compact ? 'min-h-[158px]' : 'min-h-[186px]';
  const contentGap = compact ? 'space-y-2.5' : 'space-y-3';
  const titleSpacing = compact ? 'mt-3' : 'mt-4';

  return (
    <div
      className={`relative overflow-hidden rounded-[24px] border transition-all ${
        selected
          ? 'border-[#141821] shadow-[0_14px_34px_rgba(17,24,39,0.12)] scale-[0.985]'
          : 'border-[var(--app-border)] shadow-[0_8px_24px_rgba(15,23,42,0.05)]'
      } ${compact ? 'p-2.5' : 'p-4'}`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${template.coverGradient} opacity-[0.14]`}
      />
      {templateId === 'journal' && (
        <>
          <div className="absolute right-4 top-10 h-12 w-12 rounded-full bg-white/35 blur-2xl" />
          <div className="absolute left-5 bottom-10 h-10 w-10 rounded-2xl bg-[var(--rose-soft)]/70 blur-xl" />
        </>
      )}
      {templateId === 'cinema' && (
        <div className="absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(18,24,38,0.1),transparent)]" />
      )}
      <div className="relative">
        <div className={`mb-2.5 flex items-center justify-between ${compact ? 'gap-2' : ''}`}>
          <div
            className={`inline-flex items-center justify-center ${iconSize} ${template.previewTone}`}
          >
            <Icon className={`h-4 w-4 ${template.accent}`} />
          </div>
          <div
            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${template.previewTone} ${template.accent}`}
          >
            {template.name}
          </div>
        </div>

        {templateId === 'minimal' && (
          <div className={`${contentGap} ${previewHeight}`}>
            <div className="rounded-[24px] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(148,163,184,0.10)]">
              <div className="mb-3 text-[8px] font-bold uppercase tracking-[0.28em] text-[#9aa7b7]">
                Postcard
              </div>
              <div className="mx-auto h-[52px] w-full max-w-[132px] rounded-2xl border border-[#edf2f7] bg-[linear-gradient(180deg,#ffffff_0%,#fafcff_100%)]" />
            </div>
            <div className="rounded-2xl bg-[#F8FAFC] px-4 py-3.5">
              <div className="mb-2.5 h-2.5 w-18 rounded-full bg-[#bac7d8]" />
              <div className="h-2 w-full rounded-full bg-[#d7e0eb]" />
              <div className="mt-2 h-2 w-4/5 rounded-full bg-[#dfe7f0]" />
            </div>
          </div>
        )}

        {templateId === 'diary' && (
          <div className={`${contentGap} ${previewHeight}`}>
            <div className="relative rotate-[-2deg] rounded-[24px] bg-[#fffdf8] p-3 shadow-[0_12px_26px_rgba(217,139,76,0.10)]">
              <div className="absolute right-3 top-3 text-[18px] font-bold text-[#e2c56d]">"</div>
              <div className="absolute left-4 top-2 h-5 w-12 rounded-full bg-white/70 blur-[1px]" />
              <div className="rounded-[16px] bg-[linear-gradient(135deg,#ffe5aa_0%,#ffc77b_100%)] p-2">
                <div className="h-[60px] rounded-[12px] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.05))]" />
              </div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_10px_22px_rgba(217,139,76,0.08)]">
              <div className="mb-2.5 h-2.5 w-24 rounded-full bg-[#efd173]" />
              <div className="h-2 w-full rounded-full bg-[#f7e7bb]" />
              <div className="mt-2 h-2 w-3/4 rounded-full bg-[#f4e3b1]" />
            </div>
          </div>
        )}

        {templateId === 'journal' && (
          <div className={`${contentGap} ${previewHeight}`}>
            <div className="rounded-[24px] border-2 border-dashed border-[var(--rose-strong)] bg-white/95 p-3">
              <div className="mb-2.5 inline-flex rounded-full bg-[var(--rose-ink)] px-2.5 py-1.5 text-[8px] font-bold text-white">
                贴纸
              </div>
              <div className="rounded-[16px] bg-[linear-gradient(135deg,#f8bfd8_0%,#ffe7d0_100%)] p-2">
                <div className="h-[58px] rounded-[14px] bg-white/28 backdrop-blur-sm" />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_42px] gap-2.5">
              <div className="rounded-2xl bg-white px-3.5 py-3.5 shadow-[0_10px_22px_rgba(201,75,134,0.08)]">
                <div className="h-2.5 w-16 rounded-full bg-[#f4b7d2]" />
                <div className="mt-2.5 h-2 w-full rounded-full bg-[#f9d9e7]" />
                <div className="mt-2 h-2 w-2/3 rounded-full bg-[#fadfe9]" />
              </div>
              <div className="rounded-2xl bg-[#f8e4ef]" />
            </div>
          </div>
        )}

        {templateId === 'magazine' && (
          <div className={`${contentGap} ${previewHeight}`}>
            <div className="grid grid-cols-[0.9fr_1.1fr] gap-2.5">
              <div className="flex items-end rounded-[24px] bg-[linear-gradient(180deg,#d5ece0_0%,#c4e2d4_100%)] p-2.5">
                <span className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#6c8575]">
                  01
                </span>
              </div>
              <div className="rounded-[24px] bg-white px-3.5 py-3.5 shadow-[0_10px_22px_rgba(42,162,122,0.08)]">
                <div className="mb-2.5 text-[8px] font-bold uppercase tracking-[0.22em] text-[#90a998]">
                  Feature
                </div>
                <div className="h-2 w-full rounded-full bg-[#e2f1e8]" />
                <div className="mt-2 h-2 w-5/6 rounded-full bg-[#e8f4ed]" />
                <div className="mt-4 h-9 rounded-[14px] bg-[#f3f7f4]" />
              </div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_10px_22px_rgba(42,162,122,0.06)]">
              <div className="mb-2.5 h-2.5 w-20 rounded-full bg-[#c8d4e3]" />
              <div className="h-2 w-full rounded-full bg-[#dce6ef]" />
            </div>
          </div>
        )}

        {templateId === 'cinema' && (
          <div className={`${contentGap} ${previewHeight}`}>
            <div className="rounded-[24px] bg-[#1b2130] p-3 shadow-[0_14px_26px_rgba(17,24,39,0.22)]">
              <div className="rounded-[16px] border border-white/10 bg-[#111827] p-3">
                <div className="flex h-[62px] items-end rounded-[12px] bg-[linear-gradient(135deg,#d6deeb_0%,#9fb4d0_100%)] p-3">
                  <div className="h-2.5 w-16 rounded-full bg-white/75" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_10px_22px_rgba(107,125,152,0.08)]">
              <div className="mb-2.5 text-[8px] font-bold uppercase tracking-[0.22em] text-[#97a9be]">
                Scene
              </div>
              <div className="h-2 w-full rounded-full bg-[#e9eff6]" />
            </div>
          </div>
        )}

        <div className={titleSpacing}>
          <div className={`${compact ? 'text-[13px]' : 'text-[13px]'} font-semibold text-gray-900`}>
            {template.name}
          </div>
          <div
            className={`${compact ? 'text-[10px]' : 'text-[11px]'} mt-1.5 font-bold text-gray-500`}
          >
            {template.desc}
          </div>
        </div>
      </div>
    </div>
  );
}
