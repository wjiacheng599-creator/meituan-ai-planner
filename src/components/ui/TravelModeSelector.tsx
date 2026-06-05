import React from 'react';
import type { TravelMode } from '../../types';
import { TRAVEL_MODE_META, TRAVEL_MODE_ORDER } from '../../config/travelModes';
import { Loader2 } from 'lucide-react';

export function TravelModeSelector({
  className = '',
  activeMode,
  onSelectMode,
  loadingStates = {},
}: {
  className?: string;
  activeMode: TravelMode;
  onSelectMode: (mode: TravelMode) => void;
  loadingStates?: Partial<Record<TravelMode, boolean>>;
}) {
  return (
    <div className={`w-full overflow-x-auto scrollbar-none ${className}`}>
      <div className="flex min-w-max items-stretch gap-2 pr-2">
        {TRAVEL_MODE_ORDER.map((mode) => {
          const config = TRAVEL_MODE_META[mode];
          const isSelected = activeMode === mode;
          const isLoading = loadingStates[mode];
          const Icon = config.icon;

          return (
            <button
              key={mode}
              onClick={() => onSelectMode(mode)}
              className="relative flex min-w-[70px] flex-col items-center gap-1 rounded-[16px] px-3 py-2.5 transition-all"
              style={{
                backgroundColor: isSelected ? config.bg : 'transparent',
                border: `1.5px solid ${isSelected ? config.color : 'var(--app-border)'}`,
                color: isSelected ? config.color : 'var(--app-text-soft)',
                boxShadow: isSelected ? `0 6px 16px ${config.color}20` : 'none',
              }}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Icon
                  className="w-5 h-5"
                  style={{ color: isSelected ? config.color : undefined }}
                />
              )}
              <span className="text-[11px] font-bold whitespace-nowrap">{config.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
