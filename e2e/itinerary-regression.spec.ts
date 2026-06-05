import { expect, test, type Page } from '@playwright/test';

const baseActivity = {
  timeLine: '10:00-11:00',
  type: 'activity' as const,
  description: '适合回归测试的活动',
  price: 68,
  lat: 39.915,
  lng: 116.404,
  tags: ['测试'],
};

const testPlan = {
  id: 'e2e-plan-1',
  title: '北京半日回归路线',
  durationTags: '半日',
  tags: ['回归测试'],
  summary: '用于验证行程页核心交互',
  city: '北京',
  memberCount: 2,
  totalPrice: 188,
  activities: [
    { ...baseActivity, id: 'standard-1', title: '标准博物馆', price: 88 },
    {
      ...baseActivity,
      id: 'standard-food',
      title: '标准餐厅',
      type: 'food' as const,
      timeLine: '12:00-13:00',
      price: 100,
    },
  ],
  budgetOptions: [
    {
      label: '经济版',
      perPerson: 66,
      total: 132,
      strategy: '控制预算',
      activities: [{ ...baseActivity, id: 'budget-1', title: '经济公园', price: 30 }],
    },
    {
      label: '标准版',
      perPerson: 94,
      total: 188,
      strategy: '平衡体验',
      activities: [{ ...baseActivity, id: 'standard-1', title: '标准博物馆', price: 88 }],
    },
    {
      label: '品质版',
      perPerson: 168,
      total: 336,
      strategy: '提升体验',
      activities: [{ ...baseActivity, id: 'premium-1', title: '品质剧场', price: 168 }],
    },
  ],
  uiStrategy: {
    variant: 'default' as const,
    emphasis: [],
    warnings: [],
    suggestedActions: [],
  },
};

async function seedPlanner(page: Page): Promise<void> {
  await page.addInitScript((plan) => {
    const resetPrefix = 'meituan_planner_reset_v2';
    const resetMarker = `${resetPrefix}_reset_version`;
    const resetVersion = '2026-05-19-xiaomei-update';
    const taskState = {
      planId: plan.id,
      status: 'planned',
      selectedActivityIds: [],
      bookedActivityIds: [],
      bookedVariants: [],
      completedActivityIds: [],
      lastUpdatedAt: Date.now(),
    };
    const planMessages = [
      {
        id: 'e2e-user-message',
        type: 'user',
        content: '北京半日回归路线',
      },
      {
        id: 'e2e-plan-message',
        type: 'plan',
        plan,
        content: plan.summary,
      },
    ];
    const session = {
      id: 'e2e-session-1',
      title: plan.title,
      summary: plan.summary,
      queryDraft: '北京半日回归路线',
      updatedAt: Date.now(),
      status: 'ready',
      planId: plan.id,
      planTitle: plan.title,
      planSummary: plan.summary,
      durationTags: plan.durationTags,
      totalPrice: plan.totalPrice,
      memberCount: 2,
      selectedProfileIds: [],
      messages: planMessages,
    };

    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(resetMarker, resetVersion);
    window.localStorage.setItem(`${resetPrefix}_saved_plans`, JSON.stringify([plan]));
    window.localStorage.setItem(`${resetPrefix}_task_state`, JSON.stringify([taskState]));
    window.localStorage.setItem(`${resetPrefix}_task_sessions`, JSON.stringify([session]));
    window.localStorage.setItem(
      `${resetPrefix}_active_task_session_id`,
      JSON.stringify(session.id)
    );
    window.localStorage.setItem(
      `${resetPrefix}_home_chats`,
      JSON.stringify({ messages: planMessages, updatedAt: Date.now() })
    );
    window.localStorage.setItem(
      'meituan-planner-storage',
      JSON.stringify({
        state: {
          onboardingCompleted: true,
          profiles: [],
          savedPlans: [plan],
          plannerTaskStates: [taskState],
          executionRuns: [],
          taskSessions: [session],
          activeTaskSessionId: session.id,
          orders: [],
        },
        version: 2,
      })
    );
  }, testPlan);
}

async function openSeededItinerary(page: Page): Promise<void> {
  await seedPlanner(page);
  await page.goto('/');
  await page.getByRole('button', { name: /查看完整行程/ }).click();
  await expect(page).toHaveURL(/\/itinerary/);
  await expect(page.getByRole('button', { name: '分享' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '出行方式' })).toBeVisible();
}

test('activity selection enables one-click execution', async ({ page }) => {
  await openSeededItinerary(page);

  await expect(page.getByRole('heading', { name: '标准博物馆' })).toBeVisible();
  await expect(page.getByText('先勾选要执行的项目')).toBeVisible();

  await page.getByRole('button', { name: '选择此项目' }).first().click();
  await expect(page.getByText('一键执行预订')).toBeVisible();
});

test('execution confirmation uses the member count captured by the plan', async ({ page }) => {
  await openSeededItinerary(page);

  await page.getByRole('button', { name: '选择此项目' }).first().click();
  await page.getByText('一键执行预订').click();

  await expect(page.getByText(/即将为 2 人执行以下 1 项 AI 预订/)).toBeVisible();
  await expect(page.getByText(/确认结果后再统一付款/)).toBeVisible();
});

test('budget switching changes visible activities', async ({ page }) => {
  await openSeededItinerary(page);

  await expect(page.getByRole('heading', { name: '标准博物馆' })).toBeVisible();

  await page.getByRole('button', { name: /品质版/ }).click();
  await expect(page.getByRole('heading', { name: '品质剧场' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '标准博物馆' })).toBeHidden();

  await page.getByRole('button', { name: /经济版/ }).click();
  await expect(page.getByRole('heading', { name: '经济公园' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '品质剧场' })).toBeHidden();
});
