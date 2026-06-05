/**
 * POST /api/vision/recognize
 *
 * 接收图片（base64），调用 DashScope Qwen-VL 视觉语言模型识别内容。
 * 返回识别结果：地点名、菜品名、攻略文本等。
 *
 * 请求体：{ image: string (base64), prompt?: string }
 * 响应：{ text: string, entities: Array<{type: string, name: string, detail?: string}> }
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const VISION_TIMEOUT_MS = 30000;

async function recognizeWithVision(
  imageBase64: string,
  mimeType: string,
  userPrompt?: string
): Promise<{
  text: string;
  entities: Array<{ type: string; name: string; detail?: string }>;
}> {
  // 优先 DashScope Qwen-VL，降级到 LongCat（纯文本分析）
  const useDashScope = !!DASHSCOPE_API_KEY;

  const defaultPrompt = `请分析这张图片，识别其中的内容。如果是：
1. 菜单/美食照片 → 列出菜品名称、价格、类型
2. 景点/建筑照片 → 识别地点名称、所在城市
3. 攻略/小红书截图 → 提取其中的地点、餐厅、活动信息
4. 其他图片 → 描述图片内容

返回 JSON 格式：
{
  "text": "图片描述摘要",
  "entities": [
    {"type": "restaurant|attraction|activity|food|location", "name": "名称", "detail": "补充信息"}
  ]
}`;

  const prompt = userPrompt || defaultPrompt;

  if (useDashScope) {
    // DashScope Qwen-VL API
    const response = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'qwen-vl-plus',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
                { type: 'text', text: prompt },
              ],
            },
          ],
          max_tokens: 1024,
        }),
        signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      try {
        const parsed = JSON.parse(content);
        return { text: parsed.text || content, entities: parsed.entities || [] };
      } catch {
        return { text: content, entities: [] };
      }
    }
  }

  // Fallback: LongCat 纯文本（无法处理图片，返回提示）
  return {
    text: '图片识别服务暂时不可用，请用文字描述你的需求',
    entities: [],
  };
}

router.post('/recognize', async (req: Request, res: Response) => {
  try {
    const { image, prompt, mimeType } = req.body || {};
    if (!image) {
      res.status(400).json({ error: 'Image is required (base64)' });
      return;
    }

    const result = await recognizeWithVision(image, mimeType || 'image/jpeg', prompt);
    res.json(result);
  } catch (error) {
    console.error('[vision/recognize] Failed:', error);
    const message = error instanceof Error ? error.message : 'VISION_FAILED';
    res.status(500).json({ error: message });
  }
});

export default router;
