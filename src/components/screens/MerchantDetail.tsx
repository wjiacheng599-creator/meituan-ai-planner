import { Activity } from '../../services/ai';
import { ArrowLeft, Share, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import GradientImg from '../ui/GradientImg';
import { getMerchantGalleryImages } from '../../services/imageLibrary';
import { fetchPOIImage } from '../../services/poiImageService';
import { openMapSearch, shareText } from '../../services/clientActions';
import ScreenGuard from '../ui/ScreenGuard';

interface MerchantDetailProps {
  activity: Activity | null;
  onBack: () => void;
  onBook: () => void;
}

export default function MerchantDetail({ activity, onBack, onBook }: MerchantDetailProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [realPhotos, setRealPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!activity) return;
    let disposed = false;

    async function loadPhotos() {
      if (activity!.poiPhotos && activity!.poiPhotos.length > 0) {
        if (!disposed) setRealPhotos(activity!.poiPhotos!.slice(0, 3));
        return;
      }
      if (activity!.poiId) {
        const url = await fetchPOIImage(
          activity!.title,
          undefined,
          undefined,
          undefined,
          activity!.poiId
        );
        if (!disposed && url) {
          setRealPhotos([url]);
          return;
        }
      }
      if (activity!.lat != null && activity!.lng != null) {
        const url = await fetchPOIImage(activity!.title, undefined, {
          lng: activity!.lng,
          lat: activity!.lat,
        });
        if (!disposed && url) {
          setRealPhotos([url]);
        }
      }
    }

    loadPhotos();
    return () => {
      disposed = true;
    };
  }, [activity?.id, activity?.poiId]);

  if (!activity) {
    return (
      <ScreenGuard data={activity}>
        <div className="flex h-full items-center justify-center">
          <button onClick={onBack} className="text-sm text-[var(--text-secondary)]">
            返回
          </button>
        </div>
      </ScreenGuard>
    );
  }

  const fallbackGallery = getMerchantGalleryImages(activity);
  const gallery =
    realPhotos.length > 0 ? [...realPhotos, ...fallbackGallery].slice(0, 3) : fallbackGallery;
  const isFood = activity.type === 'food';
  const isTravel = activity.type === 'travel';
  const rating = activity.rating && activity.rating > 0 ? activity.rating.toFixed(1) : '暂无评分';
  const reviewCount = '来自高德地图';
  const headlineTag = activity.businessArea
    ? `${activity.businessArea} · ${activity.tags?.[0] || '推荐'}`
    : isFood
      ? '餐饮推荐'
      : isTravel
        ? '出行推荐'
        : '活动推荐';
  const locationText =
    activity.address || activity.distanceInfo || activity.description || activity.title;
  const openTimeText = activity.openTime || '';
  const packageTitle = isFood ? '推荐套餐' : isTravel ? '推荐出行方案' : '主推专属票';
  const packageDesc = isFood
    ? '招牌单品 / 双人或多人友好搭配'
    : isTravel
      ? '路线建议 / 到店或到达前提醒'
      : '核心项目体验 / 推荐时段入场';
  const bookLabel = isFood ? '去下单' : isTravel ? '去安排' : '去预订';
  const accent = isFood
    ? {
        soft: 'bg-[var(--peach-soft)]',
        border: 'border-[var(--peach-strong)]',
        text: 'text-[var(--peach-ink)]',
        subtleText: 'text-[#aa6a37]',
      }
    : isTravel
      ? {
          soft: 'bg-[var(--sky-soft)]',
          border: 'border-[var(--sky-strong)]',
          text: 'text-[var(--sky-ink)]',
          subtleText: 'text-[#5f7089]',
        }
      : {
          soft: 'bg-[var(--rose-soft)]',
          border: 'border-[var(--rose-strong)]',
          text: 'text-[var(--rose-ink)]',
          subtleText: 'text-[#9e3f69]',
        };

  return (
    <ScreenGuard data={activity} onBack={onBack}>
      <div className="flex h-full flex-col bg-transparent overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-between p-5 pt-14 text-white pointer-events-none">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-black/30 rounded-full flex items-center justify-center backdrop-blur-md pointer-events-auto active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <button
            onClick={() =>
              shareText({
                title: activity.title,
                text: `${activity.description}\n${activity.distanceInfo || ''}`,
              })
            }
            className="w-10 h-10 bg-black/30 rounded-full flex items-center justify-center backdrop-blur-md pointer-events-auto active:scale-90 transition-transform"
          >
            <Share className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 scrollbar-none">
          {/* Cover Image Carousel */}
          <div className="h-[280px] w-full bg-gray-200 relative overflow-hidden group">
            <AnimatePresence initial={false}>
              <motion.div
                key={activeImage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <GradientImg
                  src={gallery[activeImage]}
                  alt={activity.title}
                  className="w-full h-full object-cover"
                />
              </motion.div>
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/20 mix-blend-multiply"></div>

            <div className="absolute bottom-6 right-5 bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-[8px] tracking-widest">
              {activeImage + 1} / {gallery.length}
            </div>

            <div className="absolute top-1/2 -translate-y-1/2 left-2 right-2 flex justify-between pointer-events-none">
              <button
                onClick={() => setActiveImage((prev) => (prev > 0 ? prev - 1 : gallery.length - 1))}
                className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-white pointer-events-auto backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer active:scale-90"
              >
                ‹
              </button>
              <button
                onClick={() => setActiveImage((prev) => (prev + 1) % gallery.length)}
                className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-white pointer-events-auto backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer active:scale-90"
              >
                ›
              </button>
            </div>
          </div>

          <div className="px-5 pt-6 pb-6 bg-white -mt-5 rounded-t-[32px] relative z-10 shadow-[0_-8px_30px_rgba(20,24,33,0.08)]">
            <div className="flex justify-between items-start mb-2">
              <h1 className="text-[22px] font-bold text-[var(--app-ink)] leading-tight flex-1 pr-4">
                {activity.title}
              </h1>
              <div
                className={`${accent.soft} ${accent.border} px-2 py-1.5 rounded-[12px] border flex flex-col items-center justify-center min-w-[50px] shrink-0`}
              >
                <span className={`text-[15px] font-bold ${accent.text} leading-none mb-0.5`}>
                  {rating}
                </span>
                <span className={`text-[10px] font-bold ${accent.subtleText}`}>超赞</span>
              </div>
            </div>

            <div className="flex items-center text-[13px] mb-4 gap-3">
              <span className="text-[var(--app-text)] font-bold bg-[var(--app-card-soft)] px-2 py-0.5 rounded-[6px]">
                {reviewCount} 评价
              </span>
              <span className="text-[var(--app-text)] font-bold bg-[var(--app-card-soft)] px-2 py-0.5 rounded-[6px]">
                入选「{headlineTag}」
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-6">
              {(activity.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-[11px] font-bold bg-[#F5F6F8] text-[var(--app-text)] rounded-[8px]"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="app-card-soft rounded-[24px] p-4 mb-6 shadow-[0_4px_20px_rgba(20,24,33,0.03)] border border-[var(--app-border)] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-start">
                  <span className="text-[var(--app-text-soft)] text-[13px] font-bold w-16 pt-0.5">
                    营业状态
                  </span>
                  <span className="text-[var(--mint-ink)] text-[13px] font-bold flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[var(--mint-ink)] animate-pulse"></div>{' '}
                    营业中{' '}
                    {openTimeText && (
                      <span className="text-[var(--app-text-soft)] text-[11px] font-bold ml-1 border-l border-[var(--app-border)] pl-2">
                        {openTimeText}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="w-full h-[1px] bg-gray-200/50 my-1"></div>

              <div className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-start flex-1 mr-4">
                  <span className="text-[var(--app-text-soft)] text-[13px] font-bold w-16 pt-0.5">
                    所在位置
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[var(--app-ink)] text-[13px] font-bold leading-snug group-hover:text-[var(--sky-ink)] transition-colors">
                      {locationText}
                    </span>
                    <span className="text-[var(--app-text-soft)] text-[11px] font-bold mt-1 tracking-wide">
                      {activity.timeLine || '今日可安排'} · AI 已纳入当前任务
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => openMapSearch(activity.title)}
                  className="w-12 h-12 bg-[var(--sky-soft)] text-[var(--sky-ink)] rounded-xl flex flex-col items-center justify-center shrink-0 border border-[var(--sky-strong)] active:scale-95 transition-all shadow-sm"
                >
                  <Navigation className="w-5 h-5 mb-0.5" strokeWidth={2.5} />
                  <span className="text-[10px] font-bold">导航</span>
                </button>
              </div>
            </div>

            <h3 className="font-bold text-[var(--app-ink)] text-lg mb-4">
              {isFood ? '精选套餐' : isTravel ? '推荐方案' : '精选票种'}
            </h3>

            <motion.div
              whileTap={{ scale: 0.98 }}
              className="rounded-[24px] p-5 relative overflow-hidden shadow-lg bg-gradient-to-br"
              style={{
                boxShadow:
                  '0 12px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)',
                background: `linear-gradient(135deg, rgba(255,255,255,0.9) 0%, ${isFood ? 'rgba(255,247,251,0.95)' : isTravel ? 'rgba(240,249,255,0.95)' : 'rgba(255,245,247,0.95)'} 100%)`,
              }}
            >
              {/* 装饰性背景 */}
              <div
                className="absolute top-0 right-0 w-40 h-40 opacity-20"
                style={{
                  background: isFood
                    ? 'radial-gradient(circle, rgba(254,215,170,0.6) 0%, transparent 60%)'
                    : isTravel
                      ? 'radial-gradient(circle, rgba(191,219,254,0.6) 0%, transparent 60%)'
                      : 'radial-gradient(circle, rgba(251,207,232,0.6) 0%, transparent 60%)',
                  transform: 'translate(20%, -20%)',
                }}
              />

              {/* 推荐标签 */}
              <div
                className={`absolute top-4 right-4 px-4 py-1.5 rounded-full text-xs font-bold ${accent.text}`}
                style={{
                  background: isFood
                    ? 'rgba(255,237,213,0.9)'
                    : isTravel
                      ? 'rgba(191,219,254,0.9)'
                      : 'rgba(251,207,232,0.9)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
                }}
              >
                推荐
              </div>

              {/* 主内容 */}
              <h4 className="font-bold text-[var(--app-ink)] text-xl mb-2 relative z-10">
                {packageTitle}
              </h4>
              <p className="text-sm text-[var(--app-text)] mb-6 font-medium relative z-10">
                {packageDesc}
              </p>

              {/* 价格和按钮 */}
              <div className="flex items-end justify-between relative z-10">
                <div className="flex items-baseline gap-1">
                  {activity.price > 0 ? (
                    <>
                      <span className={`text-lg font-bold ${accent.text}`}>¥</span>
                      <span
                        className={`text-[36px] font-bold ${accent.text} leading-none tracking-tight`}
                      >
                        {activity.price}
                      </span>
                      <span className="text-xs font-bold text-[var(--app-text-soft)] ml-1">
                        {isFood ? '人均' : '起'}
                      </span>
                    </>
                  ) : isFood ? (
                    <span className={`text-[28px] font-bold ${accent.text} leading-none`}>
                      价格详询
                    </span>
                  ) : (
                    <span className={`text-[28px] font-bold ${accent.text} leading-none`}>
                      免费开放
                    </span>
                  )}
                </div>
                <button
                  onClick={onBook}
                  className={`font-bold px-7 py-3 rounded-full text-base text-white transition-all active:scale-95`}
                  style={{
                    background: isFood
                      ? 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)'
                      : isTravel
                        ? 'linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)'
                        : 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                    boxShadow: isFood
                      ? '0 8px 24px rgba(245,158,11,0.4)'
                      : isTravel
                        ? '0 8px 24px rgba(59,130,246,0.4)'
                        : '0 8px 24px rgba(236,72,153,0.4)',
                  }}
                >
                  {bookLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </ScreenGuard>
  );
}
