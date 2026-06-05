import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';
import { act } from '@testing-library/react';
import type { PersonProfile } from '../../types';
import type { CopilotMessage } from '../../services/ai/types';

describe('useAppStore', () => {
  // 每个测试前重置 store
  beforeEach(() => {
    const store = useAppStore.getState();
    store.clearAll();
  });

  describe('travelMode', () => {
    it('should have default travel mode as walking', () => {
      const { travelMode } = useAppStore.getState();
      expect(travelMode).toBe('walking');
    });

    it('should update travel mode', () => {
      act(() => {
        useAppStore.getState().setTravelMode('driving');
      });

      expect(useAppStore.getState().travelMode).toBe('driving');
    });
  });

  describe('pendingPaymentIntent', () => {
    it('should store and update the payment context independently from selection state', () => {
      act(() => {
        useAppStore.getState().setPendingPaymentIntent({
          id: 'pay_plan_1_act_1',
          planId: 'plan_1',
          activityIds: ['act_1'],
          title: '测试行程',
          merchantName: '测试商家',
          amount: 88,
          serviceCount: 1,
          peopleCount: 2,
          status: 'pending',
          createdAt: 100,
        });
      });

      act(() => {
        useAppStore
          .getState()
          .setPendingPaymentIntent((prev) =>
            prev ? { ...prev, status: 'paid', orderId: 'order_1' } : prev
          );
      });

      expect(useAppStore.getState().pendingPaymentIntent).toMatchObject({
        activityIds: ['act_1'],
        amount: 88,
        peopleCount: 2,
        status: 'paid',
        orderId: 'order_1',
      });
    });
  });

  describe('currentSession', () => {
    it('should initialize with null session', () => {
      const { currentSession } = useAppStore.getState();
      expect(currentSession).toBeNull();
    });

    it('should set and clear current session', () => {
      act(() => {
        useAppStore.getState().setCurrentSession({
          id: 'session_1',
          planId: 'plan_1',
          status: 'draft' as const,
          updatedAt: Date.now(),
          title: '',
          summary: '',
          queryDraft: '',
          selectedProfileIds: [],
          messages: [],
        });
      });

      expect(useAppStore.getState().currentSession?.id).toBe('session_1');

      act(() => {
        useAppStore.getState().setCurrentSession(null);
      });

      expect(useAppStore.getState().currentSession).toBeNull();
    });
  });

  describe('profiles', () => {
    it('should initialize with empty profiles', () => {
      const { profiles } = useAppStore.getState();
      expect(profiles).toEqual([]);
    });

    it('should add a profile', () => {
      const mockProfile: PersonProfile = {
        id: 'profile_1',
        name: '测试用户',
        relation: 'self',
        ageGroup: 'young',
        dietaryPreferences: ['美食'],
        travelPreferences: ['景点'],
      };

      act(() => {
        useAppStore.getState().addProfile(mockProfile);
      });

      expect(useAppStore.getState().profiles).toHaveLength(1);
      expect(useAppStore.getState().profiles[0].name).toBe('测试用户');
    });

    it('should update a profile', () => {
      const mockProfile: PersonProfile = {
        id: 'profile_1',
        name: '测试用户',
        relation: 'self',
        ageGroup: 'young',
        dietaryPreferences: ['美食'],
        travelPreferences: [],
      };

      act(() => {
        useAppStore.getState().addProfile(mockProfile);
      });

      act(() => {
        useAppStore.getState().updateProfile('profile_1', { name: '更新用户' });
      });

      expect(useAppStore.getState().profiles[0].name).toBe('更新用户');
    });

    it('should remove a profile', () => {
      const mockProfile: PersonProfile = {
        id: 'profile_1',
        name: '测试用户',
        relation: 'self',
        ageGroup: 'young',
        dietaryPreferences: [],
        travelPreferences: [],
      };

      act(() => {
        useAppStore.getState().addProfile(mockProfile);
      });

      act(() => {
        useAppStore.getState().removeProfile('profile_1');
      });

      expect(useAppStore.getState().profiles).toHaveLength(0);
    });
  });

  describe('itinerary', () => {
    it('should initialize with empty itinerary state', () => {
      const { plan, itinerary } = useAppStore.getState();
      expect(plan).toBeNull();
      expect(itinerary.streamingActivities).toEqual([]);
      expect(itinerary.isStreaming).toBe(false);
      expect(itinerary.copilotMessages).toEqual([]);
    });

    it('should set plan', () => {
      const mockPlan = {
        id: 'plan_1',
        title: '测试行程',
        durationTags: '1天',
        tags: [],
        summary: '',
        activities: [],
        totalPrice: 0,
        city: '北京',
      };

      act(() => {
        useAppStore.getState().setPlan(mockPlan);
      });

      expect(useAppStore.getState().plan?.title).toBe('测试行程');
    });

    it('should add streaming activity', () => {
      act(() => {
        useAppStore.getState().addStreamingActivity({
          id: 'act_1',
          timeLine: '09:00',
          title: '天安门广场',
          type: 'activity',
          description: '',
          price: 0,
          tags: [],
        });
      });

      expect(useAppStore.getState().itinerary.streamingActivities).toHaveLength(1);
    });

    it('should add copilot message', () => {
      const mockMessage: CopilotMessage = {
        role: 'user',
        content: '你好',
      };

      act(() => {
        useAppStore.getState().addCopilotMessage(mockMessage);
      });

      expect(useAppStore.getState().itinerary.copilotMessages).toHaveLength(1);
    });

    it('should clear copilot messages', () => {
      act(() => {
        useAppStore.getState().addCopilotMessage({ role: 'user', content: '你好' });
      });

      act(() => {
        useAppStore.getState().clearCopilotMessages();
      });

      expect(useAppStore.getState().itinerary.copilotMessages).toHaveLength(0);
    });

    it('should add change history', () => {
      act(() => {
        useAppStore.getState().addChangeHistory('添加活动', '添加了天安门广场');
      });

      expect(useAppStore.getState().itinerary.changeHistory).toHaveLength(1);
    });

    it('should reset itinerary', () => {
      act(() => {
        useAppStore.getState().addStreamingActivity({
          id: 'act_1',
          timeLine: '09:00',
          title: '测试',
          type: 'activity',
          description: '',
          price: 0,
          tags: [],
        });
        useAppStore.getState().setIsStreaming(true);
      });

      act(() => {
        useAppStore.getState().resetItinerary();
      });

      const { itinerary } = useAppStore.getState();
      expect(itinerary.streamingActivities).toEqual([]);
      expect(itinerary.isStreaming).toBe(false);
    });
  });

  describe('preferences', () => {
    it('should have default preferences', () => {
      const { preferences } = useAppStore.getState();
      expect(preferences).toEqual({
        theme: 'light',
        language: 'zh-CN',
        metric: 'km',
      });
    });

    it('should update preferences', () => {
      act(() => {
        useAppStore.getState().setPreferences({ theme: 'dark' });
      });

      expect(useAppStore.getState().preferences.theme).toBe('dark');
    });
  });

  describe('executionRuns', () => {
    it('should upsert and cap execution runs', () => {
      act(() => {
        useAppStore.getState().upsertExecutionRun({
          id: 'exec_1',
          planId: 'plan_1',
          planTitle: '测试行程',
          status: 'completed',
          startedAt: 100,
          completedAt: 200,
          total: 2,
          successCount: 2,
          failCount: 0,
          pendingCount: 0,
          calls: [],
        });
      });

      expect(useAppStore.getState().executionRuns).toHaveLength(1);
      expect(useAppStore.getState().getLatestExecutionRunForPlan('plan_1')?.id).toBe('exec_1');

      act(() => {
        useAppStore.getState().upsertExecutionRun({
          id: 'exec_1',
          planId: 'plan_1',
          planTitle: '测试行程',
          status: 'partial_failed',
          startedAt: 100,
          completedAt: 220,
          total: 2,
          successCount: 1,
          failCount: 1,
          pendingCount: 0,
          calls: [],
        });
      });

      expect(useAppStore.getState().executionRuns).toHaveLength(1);
      expect(useAppStore.getState().executionRuns[0].status).toBe('partial_failed');
    });
  });

  describe('clearAll', () => {
    it('should reset all state to initial values', () => {
      act(() => {
        useAppStore.getState().setTravelMode('driving');
        useAppStore.getState().setCurrentSession({
          id: 'session_1',
          planId: 'plan_1',
          status: 'draft' as const,
          updatedAt: Date.now(),
          title: '',
          summary: '',
          queryDraft: '',
          selectedProfileIds: [],
          messages: [],
        });
        useAppStore.getState().addProfile({
          id: 'profile_1',
          name: '测试',
          relation: 'self',
          ageGroup: 'young',
          dietaryPreferences: [],
          travelPreferences: [],
        });
      });

      act(() => {
        useAppStore.getState().clearAll();
      });

      const state = useAppStore.getState();
      expect(state.travelMode).toBe('walking');
      expect(state.currentSession).toBeNull();
      expect(state.profiles).toEqual([]);
      expect(state.plan).toBeNull();
    });
  });
});
