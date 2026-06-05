import React from 'react';
import { Home as HomeIcon, MapPin, Route, User } from 'lucide-react';

export type Tab = 'explore' | 'plan' | 'orders' | 'profile';

interface BottomNavProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default React.memo(function BottomNav({ currentTab, onTabChange }: BottomNavProps) {
  return (
    <div className="flex items-center justify-around py-2 border-t border-[var(--app-border)] bg-white/88 backdrop-blur-xl text-[10px] font-medium text-gray-400 pb-safe z-40 relative">
      <div
        onClick={() => onTabChange('plan')}
        className={`flex flex-col items-center cursor-pointer mt-1 ${currentTab === 'plan' ? 'text-[#141821]' : 'text-gray-400 hover:text-gray-600 transition-colors'}`}
      >
        {currentTab === 'plan' ? (
          <div className="w-8 h-8 rounded-[12px] bg-[var(--brand)] flex items-center justify-center mb-1 shadow-[0_8px_18px_rgba(255,200,58,0.22)]">
            <MapPin className="w-5 h-5 text-[var(--brand-ink)]" strokeWidth={2.5} />
          </div>
        ) : (
          <MapPin className="w-6 h-6 mb-2" strokeWidth={2} />
        )}
        <span className={currentTab === 'plan' ? 'font-semibold text-[#141821] text-[11px]' : ''}>
          规划
        </span>
      </div>

      <div
        onClick={() => onTabChange('explore')}
        className={`flex flex-col items-center cursor-pointer mt-1 ${currentTab === 'explore' ? 'text-[#141821]' : 'text-gray-400 hover:text-gray-600 transition-colors'}`}
      >
        {currentTab === 'explore' ? (
          <div className="w-8 h-8 rounded-[12px] bg-[var(--brand)] flex items-center justify-center mb-1 shadow-[0_8px_18px_rgba(255,200,58,0.22)]">
            <HomeIcon className="w-5 h-5 text-[var(--brand-ink)]" strokeWidth={2.5} />
          </div>
        ) : (
          <HomeIcon className="w-6 h-6 mb-2" strokeWidth={2} />
        )}
        <span
          className={currentTab === 'explore' ? 'font-semibold text-[#141821] text-[11px]' : ''}
        >
          探索
        </span>
      </div>

      <div
        onClick={() => onTabChange('orders')}
        className={`flex flex-col items-center cursor-pointer mt-1 ${currentTab === 'orders' ? 'text-[#141821]' : 'text-gray-400 hover:text-gray-600 transition-colors'}`}
      >
        {currentTab === 'orders' ? (
          <div className="w-8 h-8 rounded-[12px] bg-[var(--brand)] flex items-center justify-center mb-1 shadow-[0_8px_18px_rgba(255,200,58,0.22)]">
            <Route className="w-5 h-5 text-[var(--brand-ink)]" strokeWidth={2.5} />
          </div>
        ) : (
          <Route className="w-6 h-6 mb-2" strokeWidth={2} />
        )}
        <span className={currentTab === 'orders' ? 'font-semibold text-[#141821] text-[11px]' : ''}>
          行程
        </span>
      </div>

      <div
        onClick={() => onTabChange('profile')}
        className={`flex flex-col items-center cursor-pointer mt-1 ${currentTab === 'profile' ? 'text-[#141821]' : 'text-gray-400 hover:text-gray-600 transition-colors'}`}
      >
        {currentTab === 'profile' ? (
          <div className="w-8 h-8 rounded-[12px] bg-[var(--brand)] flex items-center justify-center mb-1 shadow-[0_8px_18px_rgba(255,200,58,0.22)]">
            <User className="w-5 h-5 text-[var(--brand-ink)]" strokeWidth={2.5} />
          </div>
        ) : (
          <User className="w-6 h-6 mb-2" strokeWidth={2} />
        )}
        <span
          className={currentTab === 'profile' ? 'font-semibold text-[#141821] text-[11px]' : ''}
        >
          我的
        </span>
      </div>
    </div>
  );
});
