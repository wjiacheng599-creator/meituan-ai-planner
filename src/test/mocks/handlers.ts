import { http, HttpResponse } from 'msw';

// API Mock Handlers
export const handlers = [
  // 用户相关
  http.get('/api/user/profile', () => {
    return HttpResponse.json({
      id: 'user_test_123',
      name: '测试用户',
      avatar: 'https://example.com/avatar.png',
    });
  }),

  // 计划相关
  http.get('/api/plans', () => {
    return HttpResponse.json({
      plans: [
        {
          id: 'plan_1',
          title: '北京三日游',
          city: '北京',
          days: 3,
          createdAt: '2026-05-01T00:00:00Z',
        },
      ],
    });
  }),

  http.post('/api/plans/generate', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      plan: {
        id: 'plan_new_123',
        title: `AI生成的${(body as { city?: string })?.city || '城市'}行程`,
        activities: [],
        status: 'completed',
      },
    });
  }),

  http.get('/api/plans/:planId', ({ params }) => {
    return HttpResponse.json({
      plan: {
        id: params.planId,
        title: '测试行程',
        city: '北京',
        activities: [
          {
            id: 'act_1',
            name: '天安门广场',
            type: 'attraction',
            startTime: '09:00',
            endTime: '10:30',
          },
        ],
      },
    });
  }),

  // POI搜索
  http.get('/api/poi/search', ({ request }) => {
    const url = new URL(request.url);
    const keywords = url.searchParams.get('keywords');
    return HttpResponse.json({
      pois: [
        {
          id: 'poi_1',
          name: `${keywords}相关地点`,
          address: '北京市东城区',
          type: '餐饮',
          rating: 4.5,
        },
      ],
    });
  }),

  // 天气相关
  http.get('/api/weather', () => {
    return HttpResponse.json({
      city: '北京',
      temperature: 22,
      weather: '晴',
      humidity: 45,
      wind: '东北风3级',
    });
  }),

  // Copilot聊天
  http.post('/api/copilot/chat', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      message: {
        role: 'assistant',
        content: `收到您的消息：${(body as { message?: string })?.message}。这是一个测试回复。`,
      },
    });
  }),

  // 支付相关
  http.post('/api/payment/create', () => {
    return HttpResponse.json({
      orderId: 'order_test_123',
      amount: 99.99,
      status: 'pending',
    });
  }),

  http.post('/api/payment/confirm', () => {
    return HttpResponse.json({
      orderId: 'order_test_123',
      status: 'paid',
      paidAt: new Date().toISOString(),
    });
  }),

  // 分享相关
  http.post('/api/share/create', () => {
    return HttpResponse.json({
      shareId: 'share_test_123',
      shareUrl: 'https://example.com/share/share_test_123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }),

  // 错误处理测试用
  http.get('/api/test/error', () => {
    return HttpResponse.json({ error: '测试错误' }, { status: 500 });
  }),

  http.get('/api/test/timeout', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    return HttpResponse.json({ data: 'delayed' });
  }),
];
