import React from 'react';

export default function ActivityCardSkeleton() {
  return (
    <div className="flex mb-5 items-start">
      <div className="w-10 flex justify-center shrink-0 z-10 pt-3">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 animate-pulse ring-4 ring-[#F5F5F7]" />
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl border border-gray-100/60 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex">
          <div className="w-24 shrink-0 bg-gray-200 animate-pulse" style={{ minHeight: '150px' }} />

          <div className="flex-1 px-3.5 pb-3.5 pt-3 space-y-3">
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-gray-200 animate-pulse rounded-md" />
              <div className="h-5 w-12 bg-gray-200 animate-pulse rounded-md" />
            </div>

            <div className="flex items-center justify-between">
              <div className="h-5 w-3/4 bg-gray-200 animate-pulse rounded-md" />
              <div className="h-4 w-10 bg-gray-200 animate-pulse rounded-md" />
            </div>

            <div className="space-y-1.5">
              <div className="h-3 w-full bg-gray-200 animate-pulse rounded-md" />
              <div className="h-3 w-2/3 bg-gray-200 animate-pulse rounded-md" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <div className="h-5 w-12 bg-gray-200 animate-pulse rounded-md" />
                <div className="h-5 w-14 bg-gray-200 animate-pulse rounded-md" />
              </div>
              <div className="h-5 w-14 bg-gray-200 animate-pulse rounded-md" />
            </div>

            <div className="flex gap-2 pt-2.5 border-t border-gray-100/50">
              <div className="flex-1 h-8 bg-gray-200 animate-pulse rounded-xl" />
              <div className="flex-1 h-8 bg-gray-200 animate-pulse rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
