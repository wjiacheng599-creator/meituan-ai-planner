import { useState, useCallback, useEffect, useRef } from 'react';
import type { ScreenId } from '../config/screens';

// ── URL ↔ ScreenId 映射 ──

const SCREEN_PATH_MAP: Record<string, ScreenId> = {
  '': 'home',
  home: 'home',
  explore: 'explore',
  orders: 'orders',
  profile: 'profile',
  itinerary: 'itinerary',
  overview: 'overview',
  share: 'share',
  collaborate: 'collaborate',
  planning: 'planning',
  booking: 'booking',
  payment: 'payment',
  success: 'success',
  adjust: 'adjust',
  backups: 'backups',
  story: 'story',
  memories: 'memories',
  record: 'record',
  budget: 'budget_records',
  restaurant: 'restaurant_finder',
  service: 'service_finder',
};

const PATH_SCREEN_MAP: Partial<Record<ScreenId, string>> = {
  home: '/',
  explore: '/explore',
  orders: '/orders',
  profile: '/profile',
  itinerary: '/itinerary',
  overview: '/overview',
  share: '/share',
  collaborate: '/collaborate',
  planning: '/planning',
  booking: '/booking',
  payment: '/payment',
  success: '/success',
  adjust: '/adjust',
  backups: '/backups',
  story: '/story',
  memories: '/memories',
  record: '/record',
  budget_records: '/budget',
  restaurant_finder: '/restaurant',
  service_finder: '/service',
  detail: '/detail',
  explore_detail: '/explore/detail',
};

function parseScreenFromURL(): { screen: ScreenId; id?: string } {
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);
  const firstSegment = segments[0] || '';
  const screen = SCREEN_PATH_MAP[firstSegment] || 'home';
  const id = segments[1] || undefined;
  return { screen, id };
}

function buildPath(screen: ScreenId, id?: string): string {
  const base = PATH_SCREEN_MAP[screen] || `/${screen}`;
  return id ? `${base}/${id}` : base;
}

// ── Hook ──

export function useScreenNavigation() {
  // 初始化：从 URL 恢复页面状态
  const initial = parseScreenFromURL();
  const [screen, setScreen] = useState<ScreenId>(initial.screen);
  const [screenStack, setScreenStack] = useState<ScreenId[]>([initial.screen]);
  const isNavigatingRef = useRef(false);

  // 替换初始 history state（确保 popstate 能读到 screen）
  useEffect(() => {
    history.replaceState({ screen: initial.screen }, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听浏览器前进/后退
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      const screenFromState = state?.screen as ScreenId | undefined;
      const screenFromURL = parseScreenFromURL().screen;
      const targetScreen = screenFromState || screenFromURL;

      isNavigatingRef.current = true;
      setScreen(targetScreen);
      setScreenStack((prev) => {
        // 后退：如果目标在栈中，截断到该位置
        const idx = prev.lastIndexOf(targetScreen);
        if (idx >= 0 && idx < prev.length - 1) {
          return prev.slice(0, idx + 1);
        }
        // 前进：追加
        if (prev[prev.length - 1] !== targetScreen) {
          return [...prev, targetScreen];
        }
        return prev;
      });
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 同步 URL（当 screen 通过代码变化时）
  useEffect(() => {
    if (isNavigatingRef.current) return; // popstate 触发的不需要再 pushState
    const path = buildPath(screen);
    const currentPath = window.location.pathname;
    if (path !== currentPath) {
      history.pushState({ screen }, '', path);
    }
  }, [screen]);

  const navigateTo = useCallback((newScreen: ScreenId) => {
    setScreenStack((prev) => {
      if (prev[prev.length - 1] === newScreen) return prev;
      const MAX_STACK_DEPTH = 20;
      const newStack = [...prev, newScreen];
      if (newStack.length > MAX_STACK_DEPTH) {
        return [newStack[0], ...newStack.slice(newStack.length - (MAX_STACK_DEPTH - 1))];
      }
      return newStack;
    });
    setScreen(newScreen);
  }, []);

  const goBack = useCallback(() => {
    setScreenStack((prev) => {
      if (prev.length <= 1) {
        // 栈底，直接回首页
        setScreen('home');
        return ['home'];
      }
      // 弹出栈顶，直接设置目标 screen（不依赖 history.back）
      const newStack = prev.slice(0, -1);
      const targetScreen = newStack[newStack.length - 1];
      setScreen(targetScreen);
      return newStack;
    });
  }, []);

  const navigateToScreen = useCallback((targetScreen: ScreenId) => {
    setScreenStack((prev) => {
      if (prev[prev.length - 1] === targetScreen) return prev;
      const MAX_STACK_DEPTH = 20;
      const newStack = [...prev, targetScreen];
      if (newStack.length > MAX_STACK_DEPTH) {
        return [newStack[0], ...newStack.slice(newStack.length - (MAX_STACK_DEPTH - 1))];
      }
      return newStack;
    });
    setScreen(targetScreen);
  }, []);

  return {
    screen,
    setScreen,
    screenStack,
    setScreenStack,
    navigateTo,
    goBack,
    navigateToScreen,
  };
}
