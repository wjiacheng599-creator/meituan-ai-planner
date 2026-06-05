import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CarTaxiFront, MapPin, Navigation, X, Clock, ChevronRight, Loader2 } from 'lucide-react';
import { getUserLocation, estimateTaxiDispatch } from '../../services/apiAdapter';
import { dispatchTaxi as callDispatchTaxi } from './dispatchTaxiClient';

interface TaxiBookingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  from?: { name: string; lat?: number; lng?: number };
  to?: { name: string; lat?: number; lng?: number };
  activityTimeLine?: string;
}

interface TaxiTier {
  key: string;
  label: string;
  multiplier: number;
  description: string;
}

const TAXI_TIERS: TaxiTier[] = [
  { key: 'economy', label: '快车', multiplier: 1, description: '经济实惠，叫车更快' },
  { key: 'comfort', label: '舒适型', multiplier: 1.22, description: '更安静舒适' },
  { key: 'business', label: '商务六座', multiplier: 1.82, description: '大空间，适合多人' },
];

function formatFare(yuan: number): string {
  return `¥${yuan}`;
}

function formatMinutes(minutes: number): string {
  return `${minutes} 分钟`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} 米`;
  return `${(meters / 1000).toFixed(1)} 公里`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}

export default function TaxiBookingSheet({
  isOpen,
  onClose,
  from,
  to,
  activityTimeLine,
}: TaxiBookingSheetProps) {
  const [pickupName, setPickupName] = useState(from?.name || '');
  const [destName, setDestName] = useState(to?.name || '');
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>('economy');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ success: boolean; message: string } | null>(
    null
  );

  const distanceMeters = 3600;
  const durationMinutes = 17;
  const peopleCount = 1;

  const taxiRecommendation = useMemo(() => {
    return estimateTaxiDispatch({
      peopleCount,
      hasChild: false,
      hasElder: false,
      comfortPreferred: false,
      budgetSensitive: false,
      distanceMeters,
      durationMinutes,
    });
  }, [distanceMeters, durationMinutes]);

  useEffect(() => {
    if (!isOpen) return;
    if (from?.name) {
      setPickupName(from.name);
    } else {
      setIsLocating(true);
      setLocationError(false);
      getUserLocation()
        .then((loc) => {
          if (loc) {
            setPickupName(`当前位置 (${loc.lng.toFixed(4)}, ${loc.lat.toFixed(4)})`);
          } else {
            setPickupName('');
            setLocationError(true);
          }
        })
        .catch(() => {
          setPickupName('');
          setLocationError(true);
        })
        .finally(() => setIsLocating(false));
    }
    if (to?.name) {
      setDestName(to.name);
    }
  }, [isOpen, from, to]);

  const canModifyPickup = !from?.name;

  const availableTiers = useMemo(() => {
    const baseFare = 14 + (distanceMeters / 1000) * 2.6 + durationMinutes * 0.7;
    const baseWait = Math.max(2, Math.min(12, Math.round(3 + distanceMeters / 4000)));
    return TAXI_TIERS.map((tier) => ({
      ...tier,
      fare: Math.round(baseFare * tier.multiplier),
      waitMinutes:
        tier.key === 'business' ? baseWait + 3 : tier.key === 'comfort' ? baseWait + 2 : baseWait,
      recommended: taxiRecommendation.tier === tier.key,
    }));
  }, [distanceMeters, durationMinutes, taxiRecommendation]);

  useEffect(() => {
    const rec = availableTiers.find((t) => t.recommended);
    if (rec) {
      setSelectedTier(rec.key);
    }
  }, [availableTiers]);

  const selectedTierData = availableTiers.find((t) => t.key === selectedTier) || availableTiers[0];

  const handleBooking = useCallback(async () => {
    if (isBooking) return;
    setIsBooking(true);
    setBookingResult(null);
    try {
      const result = await callDispatchTaxi({
        from: pickupName || '当前位置',
        to: destName || '目的地',
        time: activityTimeLine || '现在',
        people: peopleCount,
        tierLabel: selectedTierData.label,
        estimatedFare: selectedTierData.fare,
        estimatedWaitMinutes: selectedTierData.waitMinutes,
      });
      setBookingResult(result);
    } catch {
      setBookingResult({ success: false, message: '叫车失败，请稍后重试' });
    } finally {
      setIsBooking(false);
    }
  }, [
    isBooking,
    pickupName,
    destName,
    activityTimeLine,
    peopleCount,
    selectedTierData,
    callDispatchTaxi,
  ]);

  const handleClose = useCallback(() => {
    if (isBooking) return;
    setBookingResult(null);
    onClose();
  }, [isBooking, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-[var(--app-bg)] rounded-t-[28px] max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-[18px] font-bold text-[var(--app-ink)]">叫车服务</h2>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-card-soft)] active:scale-95 transition-transform"
                disabled={isBooking}
              >
                <X className="w-4 h-4 text-[var(--app-text)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
              {bookingResult ? (
                <div className="py-8 text-center space-y-4">
                  <div
                    className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                      bookingResult.success ? 'bg-[var(--success-soft)]' : 'bg-[var(--danger-soft)]'
                    }`}
                  >
                    {bookingResult.success ? (
                      <CarTaxiFront className="w-8 h-8 text-[var(--success-ink)]" />
                    ) : (
                      <X className="w-8 h-8 text-[var(--danger-ink)]" />
                    )}
                  </div>
                  <h3 className="text-[18px] font-bold text-[var(--app-ink)]">
                    {bookingResult.success ? '叫车成功' : '叫车失败'}
                  </h3>
                  <p className="text-[13px] text-[var(--app-text)] leading-relaxed">
                    {bookingResult.message}
                  </p>
                  <button
                    onClick={handleClose}
                    className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-[var(--app-ink)] px-8 text-[13px] font-bold text-white active:scale-95 transition-transform"
                  >
                    {bookingResult.success ? '知道了' : '关闭'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl bg-white p-4 space-y-3 border border-[var(--app-border)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)]">
                        <Navigation className="w-4 h-4 text-[var(--success-ink)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-[var(--app-text-soft)] uppercase tracking-wide">
                          上车点
                        </div>
                        {isLocating ? (
                          <div className="flex items-center gap-1.5 text-[13px] text-[var(--app-text-soft)] font-medium mt-0.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            正在定位...
                          </div>
                        ) : locationError ? (
                          <input
                            type="text"
                            value={pickupName}
                            onChange={(e) => setPickupName(e.target.value)}
                            placeholder="无法定位，请手动输入上车点"
                            className="w-full bg-transparent text-[13px] font-semibold text-[var(--app-ink)] outline-none placeholder:text-[var(--app-text-soft)] mt-0.5"
                          />
                        ) : (
                          <p className="text-[13px] font-semibold text-[var(--app-ink)] mt-0.5 truncate">
                            {pickupName || '当前位置'}
                          </p>
                        )}
                      </div>
                      {canModifyPickup && !isLocating && !locationError && (
                        <button
                          onClick={() => {
                            setLocationError(true);
                            setPickupName('');
                          }}
                          className="shrink-0 text-[11px] font-bold text-[var(--brand-ink)] active:scale-95"
                        >
                          修改
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)]">
                        <MapPin className="w-4 h-4 text-[var(--brand-ink)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-[var(--app-text-soft)] uppercase tracking-wide">
                          目的地
                        </div>
                        {to?.name ? (
                          <p className="text-[13px] font-semibold text-[var(--app-ink)] mt-0.5 truncate">
                            {destName}
                          </p>
                        ) : (
                          <input
                            type="text"
                            value={destName}
                            onChange={(e) => setDestName(e.target.value)}
                            placeholder="输入目的地"
                            className="w-full bg-transparent text-[13px] font-semibold text-[var(--app-ink)] outline-none placeholder:text-[var(--app-text-soft)] mt-0.5"
                          />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 px-1 text-[11px] text-[var(--app-text)]">
                      <Clock className="w-3 h-3" />
                      <span>
                        {formatDistance(distanceMeters)} · 约 {formatDuration(durationMinutes)}
                      </span>
                      {activityTimeLine && (
                        <span className="text-[var(--brand-ink)] font-semibold">
                          {activityTimeLine}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[13px] font-bold text-[var(--app-ink)] mb-3">选择车型</h3>
                    <div className="space-y-2">
                      {availableTiers.map((tier) => (
                        <button
                          key={tier.key}
                          onClick={() => setSelectedTier(tier.key)}
                          className={`w-full flex items-center gap-3 rounded-2xl p-3.5 border transition-all active:scale-[0.98] ${
                            selectedTier === tier.key
                              ? 'border-[var(--app-ink)] bg-white shadow-sm'
                              : 'border-[var(--app-border)] bg-white/60'
                          }`}
                        >
                          <div
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                              selectedTier === tier.key
                                ? 'border-[var(--app-ink)]'
                                : 'border-gray-300'
                            }`}
                          >
                            {selectedTier === tier.key && (
                              <div className="h-2.5 w-2.5 rounded-full bg-[var(--app-ink)]" />
                            )}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-bold text-[var(--app-ink)]">
                                {tier.label}
                              </span>
                              {tier.recommended && (
                                <span className="shrink-0 rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-ink)]">
                                  推荐
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--app-text-soft)] mt-0.5">
                              {tier.description}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[15px] font-bold text-[var(--app-ink)]">
                              {formatFare(tier.fare)}
                            </p>
                            <p className="text-[10px] text-[var(--app-text-soft)]">
                              约 {formatMinutes(tier.waitMinutes)}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--app-text-soft)]" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {taxiRecommendation && (
                    <div className="rounded-2xl bg-[rgba(255,244,191,0.42)] p-4 border border-[var(--brand-soft)]">
                      <div className="flex items-center gap-2 mb-1">
                        <CarTaxiFront className="w-4 h-4 text-[var(--brand-ink)]" />
                        <span className="text-[13px] font-bold text-[var(--app-ink)]">
                          智能推荐
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-[var(--app-text)] leading-relaxed">
                        {taxiRecommendation.reason}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-bold text-[var(--app-text)]">
                          {taxiRecommendation.passengerSummary}
                        </span>
                        {taxiRecommendation.comfortTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-bold text-[var(--brand-ink)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {!bookingResult && (
              <div className="px-5 pb-8 pt-2">
                <button
                  onClick={handleBooking}
                  disabled={isBooking || !pickupName || !destName}
                  className={`w-full flex items-center justify-center gap-2 rounded-2xl h-[52px] text-[15px] font-bold text-white active:scale-[0.98] transition-all ${
                    isBooking || !pickupName || !destName
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[var(--app-ink)] shadow-lg shadow-gray-900/20'
                  }`}
                >
                  {isBooking ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      正在叫车...
                    </>
                  ) : (
                    <>
                      <CarTaxiFront className="w-5 h-5" />
                      确认叫车 {formatFare(selectedTierData.fare)}
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
