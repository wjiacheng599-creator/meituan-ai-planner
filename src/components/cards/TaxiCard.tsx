import React, { memo, useState, useCallback } from 'react';
import {
  CarTaxiFront,
  MapPin,
  Clock,
  Navigation,
  Sparkles,
  CheckCircle,
  Search,
  Phone,
  Star,
  User,
  MessageCircle,
} from 'lucide-react';
import { estimateTaxiDispatch } from '../../services/apiAdapter';
import type { DriverInfo } from '../taxi/dispatchTaxiClient';

export interface TaxiCardData {
  destinationName: string;
  lat?: number;
  lng?: number;
  distanceMeters: number;
  durationMinutes: number;
  activityTimeLine?: string;
  driver?: DriverInfo;
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

interface TaxiCardProps {
  data: TaxiCardData;
  bookingStatus?: 'idle' | 'booked';
  onBookTaxi: (data: TaxiCardData) => void;
  onDestinationChange?: (data: TaxiCardData) => void;
}

export const TaxiCard = memo(function TaxiCard({
  data,
  bookingStatus,
  onBookTaxi,
  onDestinationChange,
}: TaxiCardProps) {
  const [editingDest, setEditingDest] = useState(false);
  const [destInput, setDestInput] = useState('');

  const hasDest = data.destinationName && data.destinationName !== '请设置目的地';
  const isBooked = bookingStatus === 'booked';

  const recommendation = estimateTaxiDispatch({
    peopleCount: 1,
    hasChild: false,
    hasElder: false,
    comfortPreferred: false,
    budgetSensitive: false,
    distanceMeters: data.distanceMeters,
    durationMinutes: data.durationMinutes,
  });

  const baseFare = 14 + (data.distanceMeters / 1000) * 2.6 + data.durationMinutes * 0.7;
  const estimatedFare = Math.round(
    baseFare *
      (recommendation.tier === 'comfort' ? 1.22 : recommendation.tier === 'business' ? 1.82 : 1)
  );
  const waitMinutes = recommendation.estimatedWaitMinutes;

  const handleConfirmDest = useCallback(() => {
    if (!destInput.trim()) return;
    const newData: TaxiCardData = {
      ...data,
      destinationName: destInput.trim(),
    };
    onDestinationChange?.(newData);
    setEditingDest(false);
  }, [destInput, data, onDestinationChange]);

  return (
    <div className="app-card overflow-hidden rounded-[24px]">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full ${isBooked ? 'bg-[var(--success-soft)]' : 'bg-[var(--warning-soft)]'}`}
          >
            {isBooked ? (
              <CheckCircle className="w-4 h-4 text-[var(--success-ink)]" />
            ) : (
              <CarTaxiFront className="w-4 h-4 text-[var(--warning-ink)]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-[var(--app-ink)]">
              {isBooked ? '叫车已确认' : '叫车服务'}
            </div>
            <div className="text-[11px] text-[var(--app-text)] mt-0.5">
              {isBooked ? '车辆正在赶来，请耐心等待' : '为你找到合适的车辆'}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
              isBooked
                ? 'bg-[var(--success-soft)] text-[var(--success-ink)]'
                : 'bg-[var(--warning-soft)] text-[var(--warning-ink)]'
            }`}
          >
            {isBooked ? '已叫车' : recommendation.tierLabel}
          </span>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-amber-50/80 to-orange-50/40 p-3.5">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 mt-0.5">
              <div className="h-2 w-2 rounded-full bg-[var(--success-ink)]" />
              <div className="w-px h-6 bg-gray-200" />
              <MapPin className="w-3.5 h-3.5 text-[var(--warning-ink)]" />
            </div>
            <div className="flex-1 min-w-0 space-y-2.5">
              <div>
                <div className="text-[10px] font-bold text-[var(--app-text-soft)] uppercase tracking-wide">
                  上车点
                </div>
                <div className="text-[13px] font-semibold text-[var(--app-ink)] mt-0.5">
                  当前位置
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-[var(--app-text-soft)] uppercase tracking-wide">
                  目的地
                </div>
                {editingDest ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={destInput}
                      onChange={(e) => setDestInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleConfirmDest()}
                      placeholder="输入目的地"
                      autoFocus
                      className="flex-1 min-w-0 text-[13px] font-bold text-[var(--app-ink)] bg-white/80 rounded-lg px-2.5 py-1.5 outline-none border border-amber-200 focus:border-amber-400"
                    />
                    <button
                      onClick={handleConfirmDest}
                      className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-amber-500 text-white active:scale-95"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                ) : hasDest ? (
                  <div className="text-[13px] font-bold text-[var(--app-ink)] mt-0.5 truncate">
                    {data.destinationName}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingDest(true);
                      setDestInput('');
                    }}
                    className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-white/60 px-3 py-1.5 text-[13px] font-semibold text-[var(--warning-ink)] active:scale-[0.98]"
                  >
                    <Search className="w-3.5 h-3.5" />
                    点击输入目的地
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {hasDest && (
          <div className="flex items-center gap-2 mt-3 px-1">
            <div className="flex items-center gap-1 text-[11px] text-[var(--app-text)]">
              <Clock className="w-3 h-3" />
              <span>{formatDuration(data.durationMinutes)}</span>
            </div>
            <div className="w-px h-3 bg-gray-200" />
            <div className="flex items-center gap-1 text-[11px] text-[var(--app-text)]">
              <Navigation className="w-3 h-3" />
              <span>{formatDistance(data.distanceMeters)}</span>
            </div>
            <div className="w-px h-3 bg-gray-200" />
            <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--warning-ink)]">
              <span>¥{estimatedFare}</span>
            </div>
            {data.activityTimeLine && (
              <>
                <div className="w-px h-3 bg-gray-200" />
                <span className="text-[11px] font-semibold text-[var(--brand-ink)]">
                  {data.activityTimeLine}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {hasDest && !isBooked && (
        <div className="px-4 pb-4 pt-1">
          <div className="rounded-xl bg-[var(--app-card-soft)] p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span className="text-[11px] font-bold text-[var(--app-ink)]">智能推荐</span>
            </div>
            <p className="text-[11px] text-[var(--app-text)] leading-relaxed">
              {recommendation.reason}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[var(--app-text)]">
                {recommendation.passengerSummary}
              </span>
              {recommendation.comfortTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[var(--warning-ink)]"
                >
                  {tag}
                </span>
              ))}
              <span className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[var(--app-text)]">
                约 {waitMinutes} 分钟上车
              </span>
            </div>
          </div>

          <button
            onClick={() => onBookTaxi(data)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--app-ink)] h-12 text-[13px] font-bold text-white active:scale-[0.98] transition-transform shadow-lg shadow-[var(--app-ink)]/15"
          >
            <CarTaxiFront className="w-4.5 h-4.5" />
            <span>去叫车</span>
            <span className="text-white/70">¥{estimatedFare}</span>
          </button>
        </div>
      )}

      {isBooked && (
        <div className="px-4 pb-4 pt-1 space-y-2.5">
          {data.driver && (
            <div className="rounded-2xl bg-white border border-[var(--app-border)] p-3.5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100">
                  <User className="w-5 h-5 text-[var(--warning-ink)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-bold text-[var(--app-ink)]">
                      {data.driver.name}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-500 fill-[var(--warning-ink)]" />
                      <span className="text-[13px] font-bold text-[var(--warning-ink)]">
                        {data.driver.rating}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--app-text-soft)]">
                      {data.driver.trips}单
                    </span>
                  </div>
                  <div className="text-[13px] text-[var(--app-text)] mt-0.5">
                    {data.driver.vehicleColor} · {data.driver.vehicleModel}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[var(--app-card-soft)] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <CarTaxiFront className="w-4 h-4 text-[var(--app-text)]" />
                  <span className="text-[11px] text-[var(--app-text)]">车牌号</span>
                </div>
                <span className="text-[15px] font-bold text-[var(--app-ink)] tracking-wider">
                  {data.driver.plate}
                </span>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-[var(--success-soft)] text-[var(--success-ink)] text-[13px] font-bold active:scale-[0.98]">
                  <Phone className="w-3.5 h-3.5" />
                  联系司机
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-[var(--info-soft)] text-[var(--info-ink)] text-[13px] font-bold active:scale-[0.98]">
                  <MessageCircle className="w-3.5 h-3.5" />
                  发消息
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-[var(--success-soft)] p-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[var(--success-ink)] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[var(--success-ink)]">司机正在赶来</p>
              <p className="text-[11px] text-[var(--success-ink)] mt-0.5">
                预计 {waitMinutes} 分钟到达上车点
              </p>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-[var(--success-ink)] animate-pulse" />
              <span className="text-[11px] font-bold text-[var(--success-ink)]">进行中</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
