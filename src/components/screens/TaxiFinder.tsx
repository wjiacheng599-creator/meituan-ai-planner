import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CarTaxiFront,
  MapPin,
  Navigation,
  ArrowLeft,
  Clock,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  Star,
  User,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { getUserLocation, estimateTaxiDispatch } from '../../services/apiAdapter';
import { dispatchTaxi as callDispatchTaxi, type DriverInfo } from '../taxi/dispatchTaxiClient';
import type { TaxiCardData } from '../cards/TaxiCard';

interface TaxiFinderProps {
  data: TaxiCardData | null;
  onBack: () => void;
  onBookingComplete?: (data: TaxiCardData) => void;
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

export default function TaxiFinder({ data, onBack, onBookingComplete }: TaxiFinderProps) {
  const [pickupName, setPickupName] = useState('');
  const [destName, setDestName] = useState(data?.destinationName || '');
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>('economy');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    success: boolean;
    message: string;
    driver?: DriverInfo;
  } | null>(null);

  const distanceMeters = data?.distanceMeters || 3600;
  const durationMinutes = data?.durationMinutes || 17;
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
  }, []);

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
    if (rec) setSelectedTier(rec.key);
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
        time: data?.activityTimeLine || '现在',
        people: peopleCount,
        tier: selectedTier,
        tierLabel: selectedTierData.label,
        estimatedFare: selectedTierData.fare,
        estimatedWaitMinutes: selectedTierData.waitMinutes,
      });
      setBookingResult(result);
      if (result.success && onBookingComplete && data) {
        onBookingComplete({
          ...data,
          destinationName: destName || data.destinationName,
          driver: result.driver,
        });
      }
    } catch {
      setBookingResult({ success: false, message: '叫车失败，请稍后重试' });
    } finally {
      setIsBooking(false);
    }
  }, [isBooking, pickupName, destName, data?.activityTimeLine, peopleCount, selectedTierData]);

  return (
    <div className="flex h-full flex-col bg-[#F5F5F7] overflow-hidden">
      <div className="px-4 pt-14 pb-4 bg-white/82 backdrop-blur-xl border-b border-[var(--app-border)] shadow-[0_6px_18px_rgba(20,24,33,0.04)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="app-pill w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
              aria-label="返回"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--app-ink)]" />
            </button>
            <div className="flex items-center gap-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--warning-soft)]">
                <CarTaxiFront className="w-4 h-4 text-[var(--warning-ink)]" />
              </div>
              <h1 className="text-[20px] font-bold text-[#141821]">叫车服务</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {bookingResult ? (
          bookingResult.success ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[var(--success-soft)] p-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-soft)] mb-3">
                  <CheckCircle className="w-8 h-8 text-[var(--success-ink)]" />
                </div>
                <h3 className="text-[18px] font-bold text-[var(--app-ink)]">叫车成功</h3>
                <p className="text-[13px] text-[var(--success-ink)] mt-1">
                  司机正在赶来，请耐心等待
                </p>
              </div>

              {bookingResult.driver && (
                <div className="rounded-2xl bg-white border border-[var(--app-border)] p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100">
                      <User className="w-7 h-7 text-[var(--warning-ink)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[18px] font-bold text-[var(--app-ink)]">
                          {bookingResult.driver.name}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-[var(--warning-ink)]" />
                          <span className="text-[13px] font-bold text-[var(--warning-ink)]">
                            {bookingResult.driver.rating}
                          </span>
                        </div>
                      </div>
                      <span className="text-[13px] text-[var(--app-text-soft)]">
                        {bookingResult.driver.trips} 单
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success-ink)] active:scale-95">
                        <Phone className="w-4.5 h-4.5" />
                      </button>
                      <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--info-soft)] text-[var(--info-ink)] active:scale-95">
                        <MessageCircle className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-[var(--app-card-soft)] px-4 py-3">
                    <div>
                      <div className="text-[11px] text-[var(--app-text-soft)] font-bold">
                        车牌号
                      </div>
                      <div className="text-[20px] font-bold text-[var(--app-ink)] tracking-wider mt-0.5">
                        {bookingResult.driver.plate}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-[var(--app-text-soft)] font-bold">车辆</div>
                      <div className="text-[13px] font-bold text-[var(--app-ink)] mt-0.5">
                        {bookingResult.driver.vehicleColor} {bookingResult.driver.vehicleModel}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-1 text-[13px] text-[var(--app-text)]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>预计 {selectedTierData.waitMinutes} 分钟到达上车点</span>
                    <span className="text-[var(--app-text-soft)]">·</span>
                    <span>{selectedTierData.label}</span>
                    <span className="text-[var(--app-text-soft)]">·</span>
                    <span className="font-bold text-[var(--warning-ink)]">
                      ¥{selectedTierData.fare}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={onBack}
                className="w-full h-12 rounded-2xl bg-[var(--app-ink)] text-[15px] font-bold text-white active:scale-[0.98] transition-transform"
              >
                返回行程
              </button>
            </div>
          ) : (
            <div className="py-12 text-center space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--danger-soft)]">
                <XCircle className="w-10 h-10 text-[var(--danger-ink)]" />
              </div>
              <h3 className="text-[18px] font-bold text-[var(--app-ink)]">叫车失败</h3>
              <p className="text-[13px] text-[var(--app-text)] leading-relaxed px-8">
                {bookingResult.message}
              </p>
              <button
                onClick={onBack}
                className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-ink)] px-10 text-[15px] font-bold text-white active:scale-95 transition-transform"
              >
                关闭
              </button>
            </div>
          )
        ) : (
          <>
            <div className="rounded-2xl bg-white p-4 space-y-3 border border-[var(--app-border)]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)]">
                  <Navigation className="w-4.5 h-4.5 text-[var(--success-ink)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-[var(--app-text-soft)] uppercase tracking-wide">
                    上车点
                  </div>
                  {isLocating ? (
                    <div className="flex items-center gap-1.5 text-[13px] text-[var(--app-text-soft)] font-medium mt-0.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      正在定位...
                    </div>
                  ) : locationError ? (
                    <input
                      type="text"
                      value={pickupName}
                      onChange={(e) => setPickupName(e.target.value)}
                      placeholder="无法定位，请手动输入上车点"
                      className="w-full bg-transparent text-[15px] font-semibold text-[var(--app-ink)] outline-none placeholder:text-[var(--app-text-soft)] mt-0.5"
                    />
                  ) : (
                    <p className="text-[15px] font-semibold text-[var(--app-ink)] mt-0.5 truncate">
                      {pickupName || '当前位置'}
                    </p>
                  )}
                </div>
                {!isLocating && !locationError && (
                  <button
                    onClick={() => {
                      setLocationError(true);
                      setPickupName('');
                    }}
                    className="shrink-0 text-[13px] font-bold text-[var(--warning-ink)] active:scale-95"
                  >
                    修改
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--warning-soft)]">
                  <MapPin className="w-4.5 h-4.5 text-[var(--warning-ink)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-[var(--app-text-soft)] uppercase tracking-wide">
                    目的地
                  </div>
                  <p className="text-[15px] font-semibold text-[var(--app-ink)] mt-0.5 truncate">
                    {destName || '请输入目的地'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 px-1 text-[13px] text-[var(--app-text)]">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {formatDistance(distanceMeters)} · 约 {formatDuration(durationMinutes)}
                </span>
                {data?.activityTimeLine && (
                  <span className="text-[var(--warning-ink)] font-semibold">
                    {data.activityTimeLine}
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
                    className={`w-full flex items-center gap-3 rounded-2xl p-4 border transition-all active:scale-[0.98] ${
                      selectedTier === tier.key
                        ? 'border-[var(--app-ink)] bg-white shadow-sm'
                        : 'border-[var(--app-border)] bg-white/60'
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        selectedTier === tier.key ? 'border-[var(--app-ink)]' : 'border-gray-300'
                      }`}
                    >
                      {selectedTier === tier.key && (
                        <div className="h-2.5 w-2.5 rounded-full bg-[var(--app-ink)]" />
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-[var(--app-ink)]">
                          {tier.label}
                        </span>
                        {tier.recommended && (
                          <span className="shrink-0 rounded-md bg-[var(--warning-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--warning-ink)]">
                            推荐
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[var(--app-text-soft)] mt-0.5">
                        {tier.description}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-bold text-[var(--app-ink)]">
                        {formatFare(tier.fare)}
                      </p>
                      <p className="text-[11px] text-[var(--app-text-soft)]">
                        约 {formatMinutes(tier.waitMinutes)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--app-text-soft)]" />
                  </button>
                ))}
              </div>
            </div>

            {taxiRecommendation && (
              <div className="rounded-2xl bg-[var(--warning-soft)] p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CarTaxiFront className="w-4 h-4 text-[var(--warning-ink)]" />
                  <span className="text-[13px] font-bold text-[var(--app-ink)]">智能推荐</span>
                </div>
                <p className="text-[13px] font-semibold text-[var(--app-text)] leading-relaxed">
                  {taxiRecommendation.reason}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-bold text-[var(--app-text)]">
                    {taxiRecommendation.passengerSummary}
                  </span>
                  {taxiRecommendation.comfortTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-bold text-[var(--warning-ink)]"
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
        <div className="px-4 pb-8 pt-3 bg-white/82 backdrop-blur-xl border-t border-[var(--app-border)]">
          <button
            onClick={handleBooking}
            disabled={isBooking || !pickupName || !destName}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl h-[54px] text-[15px] font-bold text-white active:scale-[0.98] transition-all ${
              isBooking || !pickupName || !destName
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-[var(--app-ink)] shadow-lg shadow-[var(--app-ink)]/20'
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
    </div>
  );
}
