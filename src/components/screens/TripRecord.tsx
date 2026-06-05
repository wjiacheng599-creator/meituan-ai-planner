import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  Camera,
  MapPin,
  Sparkles,
  CheckCircle2,
  X,
  ImagePlus,
  FileImage,
} from 'lucide-react';
import type { Plan } from '../../services/ai';
import { loadCheckinRecords, saveCheckinRecords, type CheckinRecord } from '../../services/storage';
import {
  STORY_TEMPLATES,
  StoryTemplatePreview,
  type StoryTemplateId,
} from '../story/storyTemplates';

interface TripRecordProps {
  plan: Plan;
  onBack: () => void;
  onGenerateStory: (template: string) => void;
  completedIds?: Set<string>;
  bookedIds?: Set<string>;
  selectedIds?: Set<string>;
  onRecordChange?: (ids: Set<string>) => void;
}

export default function TripRecord({
  plan,
  onBack,
  onGenerateStory,
  completedIds,
  bookedIds,
  selectedIds,
  onRecordChange,
}: TripRecordProps) {
  const initialCheckinRecords = loadCheckinRecords().filter(
    (record) => record.planId === (plan.id || '')
  );
  const initialRecordedIds = new Set(
    initialCheckinRecords
      .filter((record) => !!record.photoDataUrl)
      .map((record) => record.activityId)
  );
  const [recordedIds, setRecordedIds] = useState<Set<string>>(initialRecordedIds);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplateId>('diary');
  const [checkinRecords, setCheckinRecords] = useState<CheckinRecord[]>(initialCheckinRecords);

  const recordMap = useMemo(
    () => new Map(checkinRecords.map((record) => [record.activityId, record])),
    [checkinRecords]
  );
  const canGenerateStory = plan.activities.some(
    (activity) => !!recordMap.get(activity.id)?.photoDataUrl
  );

  const persistCheckinRecord = (activityId: string, photoDataUrl: string) => {
    const allRecords = loadCheckinRecords();
    const nextRecord: CheckinRecord = {
      planId: plan.id || '',
      activityId,
      timestamp: Date.now(),
      mood: '开心',
      moodText: '今天这一站值得留下来。',
      photoDataUrl,
    };
    const nextRecords = [
      ...allRecords.filter(
        (record) => !(record.planId === nextRecord.planId && record.activityId === activityId)
      ),
      nextRecord,
    ];
    saveCheckinRecords(nextRecords);
    setCheckinRecords(nextRecords.filter((record) => record.planId === (plan.id || '')));
  };

  const mockPhotoSources = [
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="t1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f5af19"/><stop offset="100%" stop-color="#f12711"/></linearGradient></defs><rect width="400" height="300" fill="url(#t1)"/></svg>`)}`,
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="t2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#43e97b"/><stop offset="100%" stop-color="#38f9d7"/></linearGradient></defs><rect width="400" height="300" fill="url(#t2)"/></svg>`)}`,
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="t3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#764ba2"/></linearGradient></defs><rect width="400" height="300" fill="url(#t3)"/></svg>`)}`,
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="t4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f093fb"/><stop offset="100%" stop-color="#f5576c"/></linearGradient></defs><rect width="400" height="300" fill="url(#t4)"/></svg>`)}`,
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="t5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2193b0"/><stop offset="100%" stop-color="#6dd5ed"/></linearGradient></defs><rect width="400" height="300" fill="url(#t5)"/></svg>`)}`,
  ];

  const handleUploadClick = (activityId: string) => {
    const activity = plan.activities.find((a) => a.id === activityId);
    const source =
      activity?.poiPhotos?.[0] ||
      activity?.imageUrl ||
      mockPhotoSources[
        Math.abs(activityId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) %
          mockPhotoSources.length
      ];
    persistCheckinRecord(activityId, source);
    const newIds = new Set<string>(recordedIds);
    newIds.add(activityId);
    setRecordedIds(newIds);
    onRecordChange?.(newIds);
  };

  return (
    <div className="flex h-full flex-col bg-transparent relative overflow-hidden">
      <div className="absolute top-[-50px] right-[-50px] w-64 h-64 rounded-full bg-[var(--rose-soft)]/60 blur-[60px] pointer-events-none"></div>

      <div className="px-5 pt-14 pb-2 bg-transparent sticky top-0 z-20 flex items-center justify-between">
        <button
          onClick={onBack}
          className="app-pill w-10 h-10 flex items-center justify-center rounded-full text-[var(--app-ink)] hover:text-black hover:bg-white transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="font-bold text-[#141821] text-[18px]">行程打卡</span>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32">
        <div className="mb-6">
          <h2 className="text-[20px] font-bold text-[var(--app-ink)] mb-2">{plan.title}</h2>
          <p className="text-[var(--app-text)] text-[13px]">上传真实拍摄内容后，再生成这次回忆</p>
        </div>

        <div className="space-y-6 relative">
          <div className="absolute top-4 left-6 bottom-8 w-0.5 bg-gray-200"></div>

          {plan.activities.map((activity, index) => {
            const isRecorded = recordedIds.has(activity.id);
            const record = recordMap.get(activity.id);

            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="relative z-10 flex gap-4"
              >
                <div className="w-12 flex flex-col items-center pt-3">
                  <div
                    className={`z-10 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white shadow-sm transition-colors ${isRecorded ? 'bg-[var(--mint-ink)] text-white' : 'bg-[var(--sky-soft)] text-[var(--sky-ink)]'}`}
                  >
                    {isRecorded ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <MapPin className="w-5 h-5" />
                    )}
                  </div>
                </div>

                <div className="flex-1 app-card rounded-[24px] p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-[var(--app-ink)] text-[15px] leading-tight">
                        {activity.title}
                      </h3>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-[var(--app-card-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--app-text)]">
                          {activity.timeLine}
                        </span>
                        {isRecorded ? (
                          <span className="rounded-full border border-[var(--mint-strong)] bg-[var(--mint-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--mint-ink)]">
                            已打卡
                          </span>
                        ) : (
                          <span className="rounded-full border border-[var(--peach-strong)] bg-[var(--peach-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--peach-ink)]">
                            待上传
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!record?.photoDataUrl ? (
                    <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-card-soft)] px-4 py-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-[var(--app-border)] flex items-center justify-center text-[var(--app-text)]">
                          <ImagePlus className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-bold text-[var(--app-ink)]">
                            上传这站的真实照片
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUploadClick(activity.id)}
                        className="w-full flex items-center justify-center gap-2 bg-white py-3 rounded-xl text-[var(--app-ink)] text-[13px] font-bold border border-[var(--app-border)] active:scale-[0.98]"
                      >
                        <Camera className="w-4 h-4" />
                        模拟上传图片
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 space-y-3">
                      <div className="w-full h-40 rounded-xl overflow-hidden relative shadow-sm bg-[var(--app-card-soft)]">
                        <img
                          src={record.photoDataUrl}
                          alt={activity.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="bg-[var(--app-card-soft)] p-3 rounded-xl border border-[var(--app-border)] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileImage className="w-4 h-4 text-[var(--mint-ink)] shrink-0" />
                          <p className="text-[13px] text-[var(--app-text)] font-bold">
                            已保存这站素材，可用于生成回忆
                          </p>
                        </div>
                        <button
                          onClick={() => handleUploadClick(activity.id)}
                          className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[var(--app-text)] border border-[var(--app-border)] active:scale-[0.98]"
                        >
                          更换
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/82 backdrop-blur-xl border-t border-[var(--app-border)] pb-safe z-30 shadow-[0_-8px_30px_rgba(20,24,33,0.05)]">
        <button
          onClick={() => canGenerateStory && setShowTemplateModal(true)}
          disabled={!canGenerateStory}
          className="app-btn-primary w-full font-bold py-4 rounded-[24px] transition-all text-[15px] tracking-wide flex items-center justify-center gap-2 disabled:opacity-45 disabled:shadow-none"
        >
          <Sparkles className="w-5 h-5 text-[var(--brand-ink)]" />
          {canGenerateStory ? '结束行程，生成AI回忆' : '先上传至少一张真实照片'}
        </button>
      </div>

      <AnimatePresence>
        {showTemplateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative flex max-h-[82vh] w-full flex-col rounded-t-[32px] bg-white p-6 pb-8 shadow-2xl"
            >
              <button
                onClick={() => setShowTemplateModal(false)}
                className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center bg-[var(--app-card-soft)] rounded-full text-[var(--app-text)] hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="mb-2 flex items-center gap-2 text-[20px] font-bold text-[var(--app-ink)]">
                <Sparkles className="w-5 h-5 text-[var(--brand-ink)]" /> 选择回忆录风格
              </h3>
              <p className="mb-5 pr-8 text-[13px] font-bold leading-relaxed text-[var(--app-text)]">
                选一个你想要的讲述方式，模板只影响呈现风格，不会改掉这次行程内容。
              </p>

              <div className="mb-6 grid max-h-[54vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
                {STORY_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className="text-left active:scale-[0.99] transition-transform"
                  >
                    <StoryTemplatePreview
                      templateId={template.id}
                      selected={selectedTemplate === template.id}
                      compact
                    />
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  onGenerateStory(selectedTemplate);
                }}
                className="mt-auto w-full rounded-[24px] bg-[var(--app-ink)] py-4 text-[15px] font-bold tracking-widest text-white shadow-lg transition-all hover:bg-gray-800"
              >
                开始生成
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
