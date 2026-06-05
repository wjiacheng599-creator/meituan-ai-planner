import express from 'express';

const router = express.Router();

const AMAP_API_TIMEOUT_MS = 8000;

router.get('/amap-security-code', (_req, res) => {
  const code = process.env.VITE_AMAP_SECURITY_CODE || process.env.AMAP_SECURITY_CODE;
  if (!code) {
    return res.status(404).json({ error: 'Security code not configured' });
  }
  res.json({ code });
});

router.get('/amap', async (req, res) => {
  const { path, params } = req.query;

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const AMAP_KEY = process.env.AMAP_KEY;
  if (!AMAP_KEY) {
    return res.status(500).json({ error: 'AMAP_KEY not configured' });
  }

  const allowedPaths = [
    'ip',
    'geocode/geo',
    'geocode/regeo',
    'place/text',
    'place/around',
    'place/detail',
    'weather/weatherInfo',
    'direction/walking',
    'direction/driving',
    'direction/transit',
    'direction/bicycling',
    'direction/bicycle',
    'assistant/inputtips',
    'staticmap',
    'coordinate/convert',
  ];

  // 移除可能的 /v3/ 前缀
  let cleanPath = path.startsWith('/v3/')
    ? path.slice(4)
    : path.startsWith('v3/')
      ? path.slice(3)
      : path;

  // 移除查询参数部分，只保留路径
  const queryIndex = cleanPath.indexOf('?');
  if (queryIndex !== -1) {
    cleanPath = cleanPath.slice(0, queryIndex);
  }

  if (!allowedPaths.includes(cleanPath)) {
    return res
      .status(403)
      .json({ error: 'Path not allowed', allowed: allowedPaths, received: path });
  }

  try {
    const pathQueryString = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
    const paramsString = params ? `&${params}` : '';
    const url = `https://restapi.amap.com/v3/${cleanPath}?key=${AMAP_KEY}${pathQueryString ? `&${pathQueryString}` : ''}${paramsString}`;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[AmapProxy] Forwarding: ${path}`);
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(AMAP_API_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error('[AmapProxy] Amap API error:', response.status);
      return res.status(response.status).json({ error: 'Amap API error', status: response.status });
    }

    if (cleanPath === 'staticmap') {
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.status(200).send(Buffer.from(buffer));
    } else {
      const data = await response.json();
      res.status(200).json(data);
    }
  } catch (error) {
    console.error('[AmapProxy] Failed to call Amap:', error);
    res
      .status(500)
      .json({
        error: 'Proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

const AMAP_IMAGE_TIMEOUT_MS = 5000;
const imageCache = new Map<string, { data: Buffer; contentType: string; cachedAt: number }>();
const IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

router.get('/amap-image', async (req, res) => {
  const imageUrl = String(req.query.url || '');
  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  const allowedHosts = ['aos-cdn-image.amap.com', 'store.is.autonavi.com', 'restapi.amap.com'];
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!allowedHosts.some((host) => parsedUrl.hostname.endsWith(host))) {
    return res.status(403).json({ error: 'Host not allowed', host: parsedUrl.hostname });
  }

  const cached = imageCache.get(imageUrl);
  if (cached && Date.now() - cached.cachedAt < IMAGE_CACHE_TTL_MS) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(cached.data);
  }

  try {
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(AMAP_IMAGE_TIMEOUT_MS),
      headers: { Referer: 'https://www.amap.com/' },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Image fetch failed' });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    imageCache.set(imageUrl, { data: buffer, contentType, cachedAt: Date.now() });
    if (imageCache.size > 500) {
      const oldest = [...imageCache.entries()]
        .sort((a, b) => a[1].cachedAt - b[1].cachedAt)
        .slice(0, 100);
      oldest.forEach(([key]) => imageCache.delete(key));
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buffer);
  } catch (error) {
    console.error('[AmapImageProxy] Failed:', error);
    res.status(500).json({ error: 'Image proxy error' });
  }
});

router.post('/dashscope', async (req, res) => {
  const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;

  if (!DASHSCOPE_API_KEY) {
    return res.status(500).json({ error: 'DASHSCOPE_API_KEY not configured' });
  }

  const { model, messages, tools, temperature, max_tokens } = req.body;

  try {
    const response = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          temperature,
          max_tokens,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('[Proxy] DashScope API error:', response.status, data);
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('[Proxy] Failed to call DashScope:', error);
    res
      .status(500)
      .json({
        error: 'Proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

/**
 * SSE 流式输出代理端点
 * 将 AI 服务的流式响应转发给前端
 */
router.post('/dashscope/stream', async (req, res) => {
  const provider = process.env.VITE_AI_PROVIDER || 'dashscope';

  // 根据 provider 选择 API 配置
  let apiUrl: string;
  let apiKey: string;
  let defaultModel: string;

  if (provider === 'longcat') {
    apiUrl = 'https://api.longcat.chat/openai/v1/chat/completions';
    apiKey = process.env.LONGCAT_API_KEY || '';
    defaultModel = 'LongCat-2.0-Preview';
  } else {
    apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    apiKey = process.env.DASHSCOPE_API_KEY || '';
    defaultModel = 'qwen-plus';
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { model, messages, tools, temperature, max_tokens } = req.body;

  try {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || defaultModel,
        messages,
        tools,
        temperature,
        max_tokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SSE Proxy] API error:', response.status, errorText);
      res.write(
        `data: ${JSON.stringify({ error: `API error: ${response.status}`, detail: errorText })}\n\n`
      );
      res.end();
      return;
    }

    // 读取流式响应并转发
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // 保留最后一个可能不完整的行
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          res.write(trimmed + '\n\n');
          // 检查是否结束
          if (trimmed === 'data: [DONE]') {
            res.end();
            return;
          }
        }
      }

      // 兼容支持 flush 的服务器
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    }

    // 处理缓冲区剩余内容
    if (buffer.trim()) {
      res.write(buffer + '\n\n');
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[SSE Proxy] Failed:', error);
    try {
      res.write(
        `data: ${JSON.stringify({
          error: 'SSE Proxy error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`
      );
      res.end();
    } catch (e) {
      // 连接可能已关闭
    }
  }
});

export default router;
