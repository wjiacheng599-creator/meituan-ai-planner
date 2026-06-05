import { expect, test, type Page } from '@playwright/test';

const plan = {
  id: 'history-plan',
  title: '旧方案可恢复',
  durationTags: '半日',
  tags: ['历史记录'],
  summary: '即使旧会话没有保存消息，也应能看到关联方案。',
  city: '北京',
  totalPrice: 100,
  activities: [],
};

async function seedSessions(page: Page): Promise<void> {
  await page.addInitScript((seedPlan) => {
    const prefix = 'meituan_planner_reset_v2';
    const sessions = [
      {
        id: 'session_a',
        title: '历史对话 A',
        summary: 'A 的摘要',
        queryDraft: '',
        updatedAt: 200,
        status: 'draft',
        selectedProfileIds: ['p1'],
        messages: [{ id: 'a_user', type: 'user', content: '这是历史消息 A' }],
      },
      {
        id: 'session_b',
        title: '历史对话 B',
        summary: 'B 的摘要',
        queryDraft: '这是历史消息 B',
        updatedAt: 100,
        status: 'ready',
        planId: seedPlan.id,
        planTitle: seedPlan.title,
        selectedProfileIds: ['p1'],
        messages: [],
      },
    ];

    window.localStorage.clear();
    window.localStorage.setItem(`${prefix}_reset_version`, '2026-05-19-xiaomei-update');
    window.localStorage.setItem(`${prefix}_saved_plans`, JSON.stringify([seedPlan]));
    window.localStorage.setItem(`${prefix}_task_sessions`, JSON.stringify(sessions));
    window.localStorage.setItem(`${prefix}_active_task_session_id`, JSON.stringify('session_a'));
    window.localStorage.setItem(
      'meituan-planner-storage',
      JSON.stringify({
        state: {
          onboardingCompleted: true,
          profiles: [],
          savedPlans: [seedPlan],
          plannerTaskStates: [],
          executionRuns: [],
          taskSessions: sessions,
          activeTaskSessionId: 'session_a',
          orders: [],
        },
        version: 2,
      })
    );
  }, plan);
}

test('opens a historical conversation from task records', async ({ page }) => {
  await seedSessions(page);
  await page.goto('/');

  await expect(page.getByText('这是历史消息 A')).toBeVisible();
  await page.getByRole('button', { name: '个人中心' }).click();
  await page.getByRole('button', { name: /历史对话 B/ }).click();

  await expect(page.getByText('这是历史消息 B')).toBeVisible();
  await expect(page.getByText('旧方案可恢复')).toBeVisible();
});

test('starts a clean conversation from task records', async ({ page }) => {
  await seedSessions(page);
  await page.goto('/');

  await page.getByRole('button', { name: '个人中心' }).click();
  await page.getByRole('button', { name: '新对话' }).click();

  await expect(page.getByPlaceholder('想去哪？也可以粘贴攻略')).toHaveValue('');
  await expect(page.getByText('这是历史消息 A')).toBeHidden();
});
