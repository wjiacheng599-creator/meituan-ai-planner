import { useState } from 'react';
import {
  MapPin,
  Star,
  Heart,
  MessageCircle,
  Share2,
  Wand2,
  ChevronLeft,
  Send,
  Play,
  Navigation,
  ArrowUpRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Post, PostComment } from '../../types';
import { formatCount } from '../../services/utils';
import { openMapSearch, shareText } from '../../services/clientActions';
import GradientImg from '../ui/GradientImg';
import { getAvatarPath } from '../../utils/avatarUtils';

interface ExploreDetailProps {
  post: Post;
  relatedPosts?: Post[];
  onPostSelect?: (post: Post) => void;
  onBack: () => void;
  onInspire?: (query: string) => void;
}

export default function ExploreDetail({
  post,
  relatedPosts = [],
  onPostSelect,
  onBack,
  onInspire,
}: ExploreDetailProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<PostComment[]>(post.comments);
  const suggestedPosts = relatedPosts
    .filter((item) => item.id !== post.id)
    .filter(
      (item) =>
        item.tags.some((tag) => post.tags.includes(tag)) ||
        (item.location ?? '').split('·')[0] === (post.location ?? '').split('·')[0]
    )
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="app-shell absolute inset-0 z-50 flex flex-col"
    >
      {/* Modal Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 pt-14 bg-gradient-to-b from-black/50 to-transparent">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 -ml-0.5" />
        </button>
        <div className="flex gap-3">
          <button
            onClick={() =>
              shareText({ title: post.title, text: `${post.location}\n${post.content}` })
            }
            className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-colors cursor-pointer active:scale-95"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28 scrollbar-none bg-transparent">
        {/* Image Hero */}
        <div className="w-full h-[65vh] relative min-h-[450px]">
          {post.mediaType === 'video' && post.mediaUrl ? (
            <>
              <motion.video
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.6 }}
                src={post.mediaUrl}
                poster={post.mediaPoster || post.image}
                className="w-full h-full object-cover"
                controls
                playsInline
              />
              <div className="absolute bottom-10 right-4 bg-black/30 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full border border-white/20 flex items-center gap-1.5">
                <Play className="w-3 h-3 fill-current" />
                {post.mediaDuration || '视频'}
              </div>
            </>
          ) : (
            <>
              <motion.div
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.6 }}
                className="w-full h-full"
              >
                <GradientImg src={post.image} className="w-full h-full object-cover" alt="Detail" />
              </motion.div>
              <div className="absolute bottom-10 right-4 bg-black/30 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full border border-white/20">
                1 / 1
              </div>
            </>
          )}
          {/* Gradient Overlay for seamless transition */}
          <div className="absolute -bottom-1 left-0 right-0 h-12 bg-gradient-to-t from-[#f6f7fb] to-transparent"></div>
        </div>

        {/* Content Box */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="px-5 pt-2 pb-6 -mt-6 relative z-10 bg-[#f6f7fb] rounded-t-[24px]"
        >
          <div className="flex items-center justify-between mb-5 app-card p-3 rounded-2xl">
            <div className="flex items-center">
              <div className="relative">
                <img
                  src={getAvatarPath({ name: post.userName || '用户' })}
                  alt="avatar"
                  className="w-[42px] h-[42px] rounded-full mr-3 border border-[var(--app-border)]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="absolute bottom-0 right-2.5 w-3 h-3 bg-[var(--mint-ink)] border-2 border-white rounded-full"></div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[var(--app-ink)] text-[15px]">{post.userName}</span>
                <span className="text-[11px] text-[var(--app-text-soft)] font-medium">
                  旅行达人 • 2小时前发布
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsFollowing(!isFollowing)}
              className={`${isFollowing ? 'bg-[var(--app-card-soft)] text-[var(--app-text)] border-[var(--app-border)]' : 'bg-[var(--rose-soft)] text-[var(--rose-ink)] border-[var(--rose-strong)] hover:opacity-90'} font-bold text-[13px] px-5 py-1.5 rounded-full transition-colors border`}
            >
              {isFollowing ? '已关注' : '+ 关注'}
            </button>
          </div>

          <h1 className="font-bold text-[22px] text-[var(--app-ink)] mb-3 leading-tight tracking-tight">
            {post.title}
          </h1>

          <div className="inline-flex items-center gap-1.5 text-[var(--info-ink)] bg-[var(--info-soft)] px-3 py-1.5 rounded-xl text-[13px] font-bold mb-5 border border-[#dbe9ff]">
            <MapPin className="w-4 h-4" />
            {post.location}
          </div>

          <p className="text-[var(--app-ink)] text-[15px] leading-[1.8] mb-6 whitespace-pre-line break-all">
            {post.content}
          </p>

          <div className="flex gap-2 flex-wrap mb-8">
            {['#同款路线', '#周边游', '#神仙宝藏地'].map((tag) => (
              <span
                key={tag}
                className="text-[13px] text-[var(--sky-ink)] font-bold cursor-pointer hover:underline"
              >
                {tag}
              </span>
            ))}
          </div>

          {suggestedPosts.length > 0 && (
            <>
              <div className="rounded-[24px] app-card p-4 mb-8">
                <div className="text-[15px] font-bold text-[var(--app-ink)] mb-3">
                  继续发现相似灵感
                </div>
                <div className="space-y-3">
                  {suggestedPosts.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onPostSelect?.(item)}
                      className="w-full rounded-[24px] bg-[var(--app-card-soft)] p-3 text-left active:scale-[0.98]"
                    >
                      <div className="flex gap-3">
                        <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-2xl">
                          <GradientImg
                            src={item.mediaPoster || item.image}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-1 text-[13px] font-bold text-[var(--app-ink)]">
                            {item.title}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-[var(--app-text)]">
                            {item.location}
                          </div>
                          <div className="mt-2 line-clamp-2 text-[13px] leading-[1.6] text-[var(--app-text)]">
                            {item.content}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--app-border)]/60 my-6"></div>
            </>
          )}

          {/* Comments Section */}
          <div className="">
            <h3 className="font-bold text-[var(--app-ink)] mb-6 text-[15px] flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[var(--app-text-soft)]" />
              评论 ({comments.length})
            </h3>
            {comments.length > 0 ? (
              <div className="space-y-6">
                {comments.map((comment: PostComment, idx: number) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <img
                      src={getAvatarPath({ name: comment.user || '用户' })}
                      alt="avatar"
                      className="w-9 h-9 rounded-full mt-0.5"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="flex-1 border-b border-[var(--app-border)] pb-4">
                      <div className="flex justify-between items-start">
                        <span className="text-[13px] font-bold text-[var(--app-text)]">
                          {comment.user}
                        </span>
                        <div className="flex items-center gap-1 text-[var(--app-text-soft)]">
                          <Heart className="w-3.5 h-3.5" />
                          <span className="text-[11px]">赞</span>
                        </div>
                      </div>
                      <p className="text-[13px] text-[var(--app-ink)] mt-1.5 leading-relaxed">
                        {comment.text}
                      </p>
                      <span className="text-[11px] text-[var(--app-text-soft)] mt-2 block">
                        {comment.createdAt || '1 小时前'} • 回复
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 bg-white rounded-2xl border border-dashed border-[var(--app-border-strong)]">
                <MessageCircle
                  className="w-10 h-10 text-[var(--app-text-soft)] mb-2"
                  strokeWidth={1.5}
                />
                <span className="text-[var(--app-text-soft)] text-[13px] font-medium">
                  成为第一个评论的人吧～
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom Actions Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/82 backdrop-blur-xl border-t border-[var(--app-border)] p-3 pb-safe z-30">
        <AnimatePresence>
          {showCommentInput ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center gap-3 w-full mb-2 overflow-hidden"
            >
              <input
                autoFocus
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="说点什么吧..."
                className="flex-1 bg-[var(--app-card-soft)] rounded-full px-4 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-all"
              />
              <button
                onClick={() => {
                  if (commentText.trim()) {
                    setComments((prev) => [
                      ...prev,
                      {
                        user: '我',
                        text: commentText.trim(),
                        createdAt: '刚刚',
                      },
                    ]);
                    setCommentText('');
                  }
                  setShowCommentInput(false);
                }}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${commentText ? 'bg-[var(--brand)] text-[var(--brand-ink)]' : 'bg-[var(--app-card-soft)] text-[var(--app-text-soft)]'}`}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </motion.div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setShowCommentInput(true)}
                className="flex-1 bg-[var(--app-card-soft)] hover:bg-white text-[var(--app-text)] font-medium py-3 px-4 rounded-full transition-all text-[13px] flex items-center text-left border border-[var(--app-border)]"
              >
                说点什么...
              </button>

              <div className="flex items-center gap-4 px-2">
                <button
                  onClick={() => setIsLiked(!isLiked)}
                  className="flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                >
                  <Heart
                    className={`w-[22px] h-[22px] ${isLiked ? 'fill-[var(--rose-ink)] text-[var(--rose-ink)]' : 'text-[var(--app-ink)] hover:text-[var(--rose-ink)]'}`}
                    strokeWidth={isLiked ? 0 : 2}
                  />
                  <span
                    className={`text-[13px] font-bold ${isLiked ? 'text-[var(--rose-ink)]' : 'text-[var(--app-ink)]'}`}
                  >
                    {formatCount(post.hotCount + (isLiked ? 1 : 0))}
                  </span>
                </button>
                <button
                  onClick={() => setIsSaved(!isSaved)}
                  className="flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                >
                  <Star
                    className={`w-[22px] h-[22px] ${isSaved ? 'fill-[var(--peach-ink)] text-[var(--peach-ink)]' : 'text-[var(--app-ink)] hover:text-[var(--peach-ink)]'}`}
                    strokeWidth={isSaved ? 0 : 2}
                  />
                  <span
                    className={`text-[13px] font-bold ${isSaved ? 'text-[var(--peach-ink)]' : 'text-[var(--app-ink)]'}`}
                  >
                    {isSaved ? '已收藏' : '收藏'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>

        {!showCommentInput && (
          <button
            onClick={() => {
              if (onInspire) {
                onInspire(`参考这篇笔记内容，为我规划行程：“${post.title}” ${post.content}`);
              }
            }}
            className="app-btn-primary w-full mt-3 font-bold py-3.5 rounded-xl transition-all text-[15px] flex items-center justify-center gap-2 group"
          >
            <Wand2 className="w-[18px] h-[18px] text-[var(--brand-ink)] group-hover:rotate-12 transition-transform" />
            一键生成同款行程
          </button>
        )}
      </div>
    </motion.div>
  );
}
