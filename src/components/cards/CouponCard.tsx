import React, { useState, memo } from 'react';
import { motion } from 'motion/react';
import { Gift, Tag } from 'lucide-react';
import { copyText } from '../../services/clientActions';

export interface CouponCardData {
  id: string;
  shopName: string;
  discount: string;
  condition: string;
  validUntil: string;
  category: string;
}

function truncateText(text: string, max = 16) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export const CouponList = memo(function CouponList({
  data,
  onViewMore,
}: {
  data: CouponCardData[];
  onViewMore?: (items: CouponCardData[]) => void;
}) {
  const [claimed, setClaimed] = useState<Set<string>>(new Set());

  const handleClaim = (id: string) => {
    setClaimed((prev) => new Set(prev).add(id));
  };

  const heroCoupon = data[0];
  const restCoupons = data.slice(1);

  return (
    <div className="app-card w-full overflow-hidden rounded-[24px]">
      <div className="border-b border-[#ffe2a3] bg-[linear-gradient(135deg,rgba(255,249,235,0.98)_0%,rgba(255,244,191,0.72)_100%)] px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/88">
            <Gift className="w-4 h-4 text-[var(--brand-ink)]" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-[var(--app-ink)]">
              先把这些优惠领了再下单
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-[var(--app-text)]">
              常用门店和当前最划算的券都在这里
            </div>
          </div>
          <div className="app-chip-soft ml-auto inline-flex h-8 min-w-[54px] shrink-0 items-center justify-center rounded-full px-3 text-[11px] font-semibold whitespace-nowrap text-[var(--brand-ink)] shadow-sm">
            {data.length} 张
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['最高可省', '常用店铺', '领完再下单'].map((tag) => (
            <span
              key={tag}
              className="app-chip-soft rounded-full px-2.5 py-1 text-[10px] font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-3">
        {heroCoupon && (
          <div className="rounded-[24px] border border-[#ffe2a3] bg-[linear-gradient(135deg,rgba(255,251,241,0.98)_0%,rgba(255,244,191,0.84)_58%,rgba(255,236,160,0.72)_100%)] p-4 text-[var(--app-ink)] shadow-[0_8px_24px_rgba(255,200,58,0.12)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[22px] font-bold leading-none text-[var(--brand-ink)]">
                  {heroCoupon.discount}
                </div>
                <div className="mt-1 text-[11px] font-medium text-[var(--app-text)]">
                  {heroCoupon.condition}
                </div>
                <div className="mt-4 line-clamp-1 text-[13px] font-bold">
                  {truncateText(heroCoupon.shopName, 14)}
                </div>
                <div className="mt-1 line-clamp-1 text-[11px] font-medium text-[var(--app-text)]">
                  {heroCoupon.category} · {heroCoupon.validUntil}
                </div>
              </div>
              <button
                onClick={() => {
                  if (!claimed.has(heroCoupon.id)) {
                    handleClaim(heroCoupon.id);
                    copyText(
                      `${heroCoupon.shopName} ${heroCoupon.discount} ${heroCoupon.condition}`
                    );
                  }
                }}
                className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer ${
                  claimed.has(heroCoupon.id)
                    ? 'bg-white text-[var(--app-text-soft)]'
                    : 'border border-[#ffe2a3] bg-white text-[var(--brand-ink)]'
                }`}
              >
                {claimed.has(heroCoupon.id) ? '已领取' : '立即领'}
              </button>
            </div>
          </div>
        )}

        {restCoupons.length > 0 && (
          <div className="app-card-soft space-y-2.5 rounded-2xl p-2.5">
            {restCoupons.map((coupon, i) => {
              const isClaimed = claimed.has(coupon.id);
              return (
                <motion.div
                  key={coupon.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className="app-card flex items-center overflow-hidden rounded-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
                >
                  <div className="relative flex w-[82px] shrink-0 flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,rgba(255,251,241,0.98)_0%,rgba(255,244,191,0.9)_100%)] py-3">
                    <span className="relative text-[18px] font-bold text-[var(--brand-ink)]">
                      {coupon.discount}
                    </span>
                    <span className="relative mt-0.5 line-clamp-1 px-1 text-center text-[10px] font-medium text-[var(--app-text)]">
                      {truncateText(coupon.condition, 8)}
                    </span>
                  </div>
                  <div className="flex-1 px-3 py-2.5 min-w-0">
                    <h4 className="line-clamp-1 text-[13px] font-bold text-[var(--app-ink)]">
                      {truncateText(coupon.shopName, 16)}
                    </h4>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Tag className="w-3 h-3 text-gray-400" />
                      <span className="line-clamp-1 text-[10px] font-medium text-[var(--app-text)]">
                        {truncateText(coupon.category, 8)}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--app-text-soft)]">
                        {coupon.validUntil}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!isClaimed) {
                        handleClaim(coupon.id);
                        copyText(`${coupon.shopName} ${coupon.discount} ${coupon.condition}`);
                      }
                    }}
                    className={`mr-3 min-w-[52px] rounded-full px-3 py-2 text-[10px] font-semibold shrink-0 active:scale-95 transition-all cursor-pointer ${
                      isClaimed
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-[var(--brand-soft)] text-[var(--brand-ink)]'
                    }`}
                  >
                    {isClaimed ? '已领' : '领取'}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => onViewMore?.(data)}
          className="h-11 w-full rounded-[16px] border border-[#ffe2a3] bg-[var(--brand-soft)] text-[13px] font-semibold text-[var(--brand-ink)] active:scale-[0.98] transition-transform cursor-pointer"
        >
          查看更多优惠
        </button>
      </div>
    </div>
  );
});
