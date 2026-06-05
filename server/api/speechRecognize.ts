/**
 * POST /api/speech/recognize
 *
 * 接收音频 Blob，调用阿里云 DashScope SenseVoice 语音识别，返回识别文本。
 * 使用 DashScope 的文件转写 API（非实时流式），单次请求返回结果，无需轮询。
 *
 * 请求体：raw audio blob (Content-Type: audio/webm 或 audio/mp4)
 * 响应：{ text: string }
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const DASHSCOPE_ASR_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription';

async function transcribeWithDashScope(audioBase64: string, format: string): Promise<string> {
  if (!DASHSCOPE_API_KEY) {
    throw new Error('DASHSCOPE_API_KEY not configured');
  }

  // DashScope SenseVoice 文件转写：提交任务
  const submitResp = await fetch(DASHSCOPE_ASR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify({
      model: 'sensevoice-v1',
      input: {
        file_urls: [`data:audio/${format};base64,${audioBase64}`],
      },
      parameters: {
        language_hints: ['zh', 'en'],
      },
    }),
  });

  const submitData = await submitResp.json() as Record<string, unknown>;
  if (!submitResp.ok) {
    throw new Error(`DashScope ASR submit failed: ${JSON.stringify(submitData)}`);
  }

  // 检查是否同步返回（短音频可能直接返回结果）
  const output = submitData.output as Record<string, unknown> | undefined;
  if (output) {
    const results = output.results as Array<{ transcription_url?: string; subtask_status?: string }> | undefined;
    if (results && results.length > 0 && results[0].subtask_status === 'SUCCEEDED') {
      // 如果有 transcription_url，需要 fetch 获取文本
      const url = results[0].transcription_url;
      if (url) {
        const textResp = await fetch(url);
        const textData = await textResp.json() as Record<string, unknown>;
        const transcriptions = textData.transcriptions as Array<{ text?: string }> | undefined;
        if (transcriptions && transcriptions.length > 0) {
          return transcriptions.map(t => t.text || '').join('');
        }
      }
    }
  }

  // 异步模式：需要轮询获取结果
  const taskId = (submitData.output as Record<string, unknown>)?.task_id as string
    || (submitData.request_id as string);

  if (!taskId) {
    throw new Error('No task_id returned from DashScope ASR');
  }

  // 轮询结果
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, i < 5 ? 500 : 1000));

    const queryResp = await fetch(`${DASHSCOPE_ASR_URL}?task_id=${taskId}`, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      },
    });

    const result = await queryResp.json() as Record<string, unknown>;
    const output = result.output as Record<string, unknown> | undefined;
    if (!output) continue;

    const status = output.task_status as string;

    if (status === 'SUCCEEDED') {
      const results = output.results as Array<{ transcription_url?: string }> | undefined;
      if (results && results.length > 0 && results[0].transcription_url) {
        const textResp = await fetch(results[0].transcription_url);
        const textData = await textResp.json() as Record<string, unknown>;
        const transcriptions = textData.transcriptions as Array<{ text?: string }> | undefined;
        if (transcriptions && transcriptions.length > 0) {
          return transcriptions.map(t => t.text || '').join('');
        }
      }
      return '';
    }

    if (status === 'FAILED') {
      const code = output.code as string || '';
      const message = output.message as string || '';
      throw new Error(`ASR failed: ${code} ${message}`);
    }

    // PENDING / RUNNING → 继续等待
  }

  throw new Error('ASR timeout');
}

// ── 路由 ──

router.post('/recognize', async (req: Request, res: Response) => {
  try {
    const contentType = req.headers['content-type'] || 'audio/webm';
    const format = contentType.includes('webm') ? 'webm'
      : contentType.includes('mp4') ? 'mp4'
      : contentType.includes('wav') ? 'wav'
      : 'webm';

    // req.body 可能是 Buffer（express.raw）或已被 json 中间件解析
    let audioBuffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      audioBuffer = req.body;
    } else if (req.body && typeof req.body === 'object' && req.body.buffer) {
      audioBuffer = Buffer.from(req.body.buffer);
    } else {
      res.status(400).json({ error: 'Invalid audio data' });
      return;
    }

    // 太短的音频直接返回空
    if (audioBuffer.length < 1000) {
      res.json({ text: '' });
      return;
    }

    const audioBase64 = audioBuffer.toString('base64');
    const text = await transcribeWithDashScope(audioBase64, format);
    res.json({ text });
  } catch (error) {
    console.error('[speech/recognize] Failed:', error);
    const message = error instanceof Error ? error.message : 'ASR_FAILED';
    res.status(500).json({ error: message });
  }
});

export default router;
