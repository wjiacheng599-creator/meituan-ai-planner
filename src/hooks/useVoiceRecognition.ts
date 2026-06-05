/**
 * useVoiceRecognition - 双通道语音识别 hook
 *
 * 优先使用 Web Speech API（浏览器原生），不可用时降级到服务端阿里云 ASR。
 * "按住说话"交互：按住录音 → 松开发送 → 滑出取消。
 */
import { useState, useRef, useCallback, useEffect } from 'react';

// ── Web Speech API 类型 ──

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

function getWebSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    ((w.SpeechRecognition ?? w.webkitSpeechRecognition) as SpeechRecognitionConstructor | null) ??
    null
  );
}

// ── 服务端 ASR 调用 ──

async function recognizeViaServer(audioBlob: Blob): Promise<string> {
  const resp = await fetch('/api/speech/recognize', {
    method: 'POST',
    headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
    body: audioBlob,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'ASR request failed' }));
    throw new Error(err.error || `ASR failed: ${resp.status}`);
  }
  const data = await resp.json();
  return data.text || '';
}

// ── 类型 ──

export type VoiceStatus = 'idle' | 'listening' | 'stopping' | 'error';

export interface UseVoiceRecognitionReturn {
  isSupported: boolean;
  status: VoiceStatus;
  isListening: boolean;
  finalText: string;
  interimText: string;
  error: string | null;
  startListening: (options?: { onStop?: (text: string) => void }) => void;
  stopListening: () => Promise<string>;
  cancelListening: () => void;
}

export function useVoiceRecognition(): UseVoiceRecognitionReturn {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  // Web Speech API refs
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const webSpeechTextRef = useRef('');
  const webSpeechSupportedRef = useRef(false);

  // MediaRecorder refs (for server-side ASR)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stopResolveRef = useRef<((text: string) => void) | null>(null);
  const onStopRef = useRef<((text: string) => void) | null>(null);

  // Shared
  const modeRef = useRef<'webspeech' | 'server' | null>(null);
  const isCancelledRef = useRef(false);
  const stopRequestedRef = useRef(false);

  const isSupported =
    typeof window !== 'undefined' &&
    (getWebSpeechRecognition() !== null ||
      (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'));

  // 检测 Web Speech API 是否真正可用（需要安全上下文）
  useEffect(() => {
    const SR = getWebSpeechRecognition();
    if (!SR) {
      webSpeechSupportedRef.current = false;
      return;
    }
    // Web Speech API 在非 localhost 的 HTTP 下不可用
    const isSecure = window.isSecureContext;
    webSpeechSupportedRef.current = isSecure && SR !== null;
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* */
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── Web Speech API 路径 ──

  const startWebSpeech = useCallback(() => {
    const SR = getWebSpeechRecognition();
    if (!SR) return false;

    webSpeechTextRef.current = '';
    setInterimText('');

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalPart = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalPart += transcript;
        } else {
          interim += transcript;
        }
      }
      if (finalPart) {
        webSpeechTextRef.current += finalPart;
        setFinalText(webSpeechTextRef.current);
        setInterimText('');
      } else {
        setInterimText(interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('[WebSpeech] Error:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      // 降级到 server 模式
      if (event.error === 'not-allowed' || event.error === 'network') {
        modeRef.current = 'server';
        startServerRecording();
      } else {
        setError(`语音识别出错: ${event.error}`);
        setStatus('error');
      }
    };

    recognition.onend = () => {
      if (isCancelledRef.current) {
        setStatus('idle');
        return;
      }
      const text = webSpeechTextRef.current.trim();
      if (text) {
        // 有结果，直接返回
        if (stopResolveRef.current) {
          stopResolveRef.current(text);
          stopResolveRef.current = null;
        }
        onStopRef.current?.(text);
        setStatus('idle');
      } else {
        if (stopRequestedRef.current) {
          if (stopResolveRef.current) {
            stopResolveRef.current('');
            stopResolveRef.current = null;
          }
          onStopRef.current?.('');
          setStatus('idle');
          return;
        }
        // 没有识别到文字，降级到 server 录音
        console.log('[WebSpeech] No result, falling back to server ASR');
        modeRef.current = 'server';
        startServerRecording();
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      modeRef.current = 'webspeech';
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── MediaRecorder + Server ASR 路径 ──

  const startServerRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // 清理麦克风
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (isCancelledRef.current) {
          setStatus('idle');
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 1000) {
          // 太短，忽略
          if (stopResolveRef.current) {
            stopResolveRef.current('');
            stopResolveRef.current = null;
          }
          onStopRef.current?.('');
          setStatus('idle');
          return;
        }

        setStatus('stopping');
        setInterimText('识别中...');

        try {
          const text = await recognizeViaServer(blob);
          setFinalText(text);
          setInterimText('');
          if (stopResolveRef.current) {
            stopResolveRef.current(text);
            stopResolveRef.current = null;
          }
          onStopRef.current?.(text);
        } catch (err) {
          console.error('[ServerASR] Failed:', err);
          setError('语音识别失败，请重试');
          if (stopResolveRef.current) {
            stopResolveRef.current('');
            stopResolveRef.current = null;
          }
          onStopRef.current?.('');
        }
        setStatus('idle');
      };

      recorder.start(250); // 每 250ms 收集一次数据
      mediaRecorderRef.current = recorder;
      modeRef.current = 'server';
      setStatus('listening');
      setInterimText('');
    } catch (err) {
      console.error('[ServerASR] getUserMedia failed:', err);
      setError('无法访问麦克风，请检查浏览器权限');
      setStatus('error');
      if (stopResolveRef.current) {
        stopResolveRef.current('');
        stopResolveRef.current = null;
      }
    }
  }, []);

  // ── 公开方法 ──

  const startListening = useCallback(
    (options?: { onStop?: (text: string) => void }) => {
      isCancelledRef.current = false;
      stopRequestedRef.current = false;
      onStopRef.current = options?.onStop ?? null;
      setError(null);
      setFinalText('');
      setInterimText('');
      webSpeechTextRef.current = '';

      // 优先 Web Speech API
      if (webSpeechSupportedRef.current) {
        const started = startWebSpeech();
        if (started) {
          setStatus('listening');
          return;
        }
      }

      // 降级到 server 录音
      setStatus('listening');
      startServerRecording();
    },
    [startWebSpeech, startServerRecording]
  );

  const stopListening = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      stopResolveRef.current = resolve;

      if (modeRef.current === 'webspeech' && recognitionRef.current) {
        // Web Speech: onend 回调里会 resolve
        stopRequestedRef.current = true;
        try {
          recognitionRef.current.stop();
        } catch {
          const text = webSpeechTextRef.current.trim();
          resolve(text);
          stopResolveRef.current = null;
          onStopRef.current?.(text);
          setStatus('idle');
        }
      } else if (modeRef.current === 'server' && mediaRecorderRef.current?.state === 'recording') {
        // MediaRecorder: onstop 回调里会 resolve
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      } else {
        // 没有活跃的录音
        resolve('');
        stopResolveRef.current = null;
        onStopRef.current?.('');
        setStatus('idle');
      }
    });
  }, []);

  const cancelListening = useCallback(() => {
    isCancelledRef.current = true;
    stopRequestedRef.current = false;
    stopResolveRef.current = null;
    onStopRef.current = null;
    setFinalText('');
    setInterimText('');
    webSpeechTextRef.current = '';

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* */
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* */
      }
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStatus('idle');
  }, []);

  // 错误自动清除
  useEffect(() => {
    if (status === 'error' && error) {
      const timer = setTimeout(() => {
        setError(null);
        setStatus('idle');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [status, error]);

  return {
    isSupported,
    status,
    isListening: status === 'listening',
    finalText,
    interimText,
    error,
    startListening,
    stopListening,
    cancelListening,
  };
}
