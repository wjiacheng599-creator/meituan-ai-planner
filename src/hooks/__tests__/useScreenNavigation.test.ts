import { beforeEach, describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScreenNavigation } from '../useScreenNavigation';

describe('useScreenNavigation', () => {
  beforeEach(() => {
    history.replaceState({ screen: 'home' }, '', '/');
  });

  describe('initial state', () => {
    it('should initialize with home screen', () => {
      const { result } = renderHook(() => useScreenNavigation());
      expect(result.current.screen).toBe('home');
    });

    it('should have home in screen stack', () => {
      const { result } = renderHook(() => useScreenNavigation());
      expect(result.current.screenStack).toContain('home');
    });
  });

  describe('navigateTo', () => {
    it('should navigate to a new screen', () => {
      const { result } = renderHook(() => useScreenNavigation());

      act(() => {
        result.current.navigateTo('profile');
      });

      expect(result.current.screen).toBe('profile');
    });

    it('should push screen to stack', () => {
      const { result } = renderHook(() => useScreenNavigation());

      act(() => {
        result.current.navigateTo('profile');
      });

      expect(result.current.screenStack).toContain('home');
      expect(result.current.screenStack).toContain('profile');
    });

    it('should not navigate to same screen', () => {
      const { result } = renderHook(() => useScreenNavigation());

      act(() => {
        result.current.navigateTo('home');
      });

      expect(result.current.screen).toBe('home');
      // home should not be duplicated in stack
      const homeCount = result.current.screenStack.filter((s) => s === 'home').length;
      expect(homeCount).toBe(1);
    });
  });

  describe('goBack', () => {
    it('should go back to previous screen', () => {
      const { result } = renderHook(() => useScreenNavigation());

      act(() => {
        result.current.navigateTo('profile');
      });

      act(() => {
        result.current.goBack();
      });

      expect(result.current.screen).toBe('home');
    });

    it('should not go back when at home', () => {
      const { result } = renderHook(() => useScreenNavigation());

      act(() => {
        result.current.goBack();
      });

      expect(result.current.screen).toBe('home');
    });

    it('should handle multiple go back calls', () => {
      const { result } = renderHook(() => useScreenNavigation());

      act(() => {
        result.current.navigateTo('profile');
      });

      act(() => {
        result.current.navigateToScreen('settings');
      });

      act(() => {
        result.current.goBack();
      });

      expect(result.current.screen).toBe('profile');

      act(() => {
        result.current.goBack();
      });

      expect(result.current.screen).toBe('home');
    });
  });

  describe('navigateToScreen', () => {
    it('should navigate to a target screen', () => {
      const { result } = renderHook(() => useScreenNavigation());

      act(() => {
        result.current.navigateToScreen('settings');
      });

      expect(result.current.screen).toBe('settings');
    });
  });
});
