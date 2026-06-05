import React from 'react';
import { Clock } from 'lucide-react';

interface HomeCardProps {
  title: string;
  index: number;
  location?: { lat: number; lng: number; name: string };
  travelTime?: number;
}

function HomeCard({ title, index, location, travelTime }: HomeCardProps) {
  const isStart = title === '起点';
  const displayName = location?.name || '当前位置';

  return (
    <div className="relative z-10 mb-4">
      {travelTime != null && (
        <div className="flex items-center ml-[19px] mb-2.5">
          <div className="flex items-center gap-1.5 bg-[var(--app-card)] backdrop-blur-sm px-2.5 py-1 rounded-full border border-[var(--app-border)] shadow-sm">
            <Clock className="w-3 h-3 text-[var(--sky-ink)]" />
            <span className="text-[10px] font-bold text-[var(--app-text)]">{travelTime} min</span>
          </div>
        </div>
      )}
      <div className="flex">
        <div className="w-10 flex justify-center shrink-0 z-10 pt-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--sky-soft)] ring-4 ring-[var(--app-bg)] shadow-md">
            <Clock className="w-2.5 h-2.5 text-[var(--sky-ink)]" strokeWidth={3} />
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] shadow-[var(--shadow-card)]">
          <div className="flex">
            <div className="w-24 shrink-0 overflow-hidden bg-gray-100 border-r border-[var(--app-border)] flex items-center justify-center">
              <img
                src={`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a1c4fd"/><stop offset="50%" stop-color="#c2e9fb"/><stop offset="100%" stop-color="#e2d1c3"/></linearGradient></defs><rect width="400" height="300" fill="url(#hg)"/></svg>`)}`}
                alt="温馨的家"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex-1 px-3 pb-3 pt-2.5">
              <div className="flex items-center justify-between mb-1 shrink-0">
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                  <span className="text-[11px] font-bold text-[var(--app-ink)] bg-gray-50 px-2 py-0.5 rounded-md font-mono">
                    {isStart ? '出发' : '返回'}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[var(--sky-soft)] text-[var(--sky-ink)] flex items-center gap-0.5">
                    家
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between mb-1 min-h-[22px]">
                <h3 className="mr-2 flex-1 text-[13px] font-bold text-[var(--app-ink)] leading-tight min-w-0">
                  {title}
                </h3>
              </div>

              <p className="text-[11px] leading-relaxed mb-2 text-[var(--app-text)]">
                {displayName}
              </p>

              <div className="flex items-center justify-between min-h-[18px]">
                <div className="flex flex-wrap gap-1 max-w-[calc(100%-60px)] overflow-hidden">
                  <span className="text-[10px] text-[var(--app-text-soft)] font-medium bg-gray-50 px-2 py-0.5 rounded-md">
                    {location?.name || '温馨的家'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(HomeCard);
