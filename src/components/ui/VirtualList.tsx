import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimateHeight: number;
  overscan?: number;
  threshold?: number;
  className?: string;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateHeight,
  overscan = 5,
  threshold = 20,
  className = '',
}: VirtualListProps<T>) {
  const [visibleRange, setVisibleRange] = useState({
    start: 0,
    end: Math.min(threshold, items.length),
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const totalHeight = items.length * estimateHeight;

  const visibleItems = items.slice(
    Math.max(0, visibleRange.start - overscan),
    Math.min(items.length, visibleRange.end + overscan)
  );

  const calculateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const start = Math.floor(scrollTop / estimateHeight);
    const end = Math.ceil((scrollTop + containerHeight) / estimateHeight);
    setVisibleRange({ start, end });
  }, [estimateHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sentinel = sentinelRef.current;
    if (!sentinel || items.length <= threshold) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          calculateVisibleRange();
        }
      },
      { root: container, threshold: 0.1 }
    );

    observer.observe(sentinel);

    container.addEventListener('scroll', calculateVisibleRange, { passive: true });
    calculateVisibleRange();

    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', calculateVisibleRange);
    };
  }, [calculateVisibleRange, items.length, threshold]);

  if (items.length <= threshold) {
    return <div className={className}>{items.map(renderItem)}</div>;
  }

  return (
    <div ref={containerRef} className={`overflow-y-auto overscroll-contain ${className}`}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: Math.max(0, visibleRange.start - overscan) * estimateHeight,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, idx) => {
            const globalIndex = Math.max(0, visibleRange.start - overscan) + idx;
            return renderItem(item, globalIndex);
          })}
        </div>
        <div ref={sentinelRef} style={{ height: 1, position: 'absolute', bottom: 0 }} />
      </div>
    </div>
  );
}
