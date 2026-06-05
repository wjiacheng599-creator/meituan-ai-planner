import { ReactNode } from 'react';

export default function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[linear-gradient(180deg,#f9fbff_0%,#eef2f9_100%)]">
      <div className="relative h-full max-h-[896px] w-full max-w-[414px] overflow-hidden bg-transparent shadow-[0_28px_80px_rgba(20,24,33,0.14)] sm:rounded-[3rem] sm:border-[8px] sm:border-[#131722]">
        {/* iOS Status Bar Mock */}
        <div className="absolute top-0 z-50 flex w-full items-center justify-between px-8 pt-3 pb-2 text-[13px] font-semibold text-[#111318]">
          <span>9:41</span>
          <div className="flex items-center space-x-1.5">
            {/* Cellular */}
            <div className="flex items-end space-x-[1.5px] h-[10px]">
              <div className="w-[3px] h-[30%] bg-[#111318] rounded-full"></div>
              <div className="w-[3px] h-[50%] bg-[#111318] rounded-full"></div>
              <div className="w-[3px] h-[75%] bg-[#111318] rounded-full"></div>
              <div className="w-[3px] h-[100%] bg-[#111318] rounded-full"></div>
            </div>
            {/* Wi-Fi */}
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
            {/* Battery */}
            <div className="relative w-[22px] h-[11px] border-[1px] border-[#111318]/40 rounded-[3px] px-[1px] py-[1px] flex items-center">
              <div className="w-[100%] h-full bg-[#111318] rounded-[1px]"></div>
              <div className="absolute -right-[3px] top-1/2 -translate-y-1/2 w-[2px] h-[4px] bg-[#111318]/40 rounded-r-[1px]"></div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="app-shell relative flex h-full w-full flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
