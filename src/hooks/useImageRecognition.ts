import { apiUrl } from "../services/apiBase";
/**
 * useImageRecognition — 图片识别 hook
 *
 * 提供图片选择、预览、识别功能。
 */
import { useState, useCallback, useRef } from 'react';

export interface ImagePreview {
  file: File;
  dataUrl: string;
}

export interface VisionResult {
  text: string;
  entities: Array<{ type: string; name: string; detail?: string }>;
}

export function useImageRecognition() {
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [visionResult, setVisionResult] = useState<VisionResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectImage = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) return;
    // 验证文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview({ file, dataUrl: reader.result as string });
      setVisionResult(null);
    };
    reader.readAsDataURL(file);

    // 重置 input 以便重复选择同一文件
    e.target.value = '';
  }, []);

  const removeImage = useCallback(() => {
    setImagePreview(null);
    setVisionResult(null);
  }, []);

  const recognizeImage = useCallback(async (): Promise<VisionResult | null> => {
    if (!imagePreview) return null;

    setIsRecognizing(true);
    try {
      // 将图片转为 base64（去掉 data:image/xxx;base64, 前缀）
      const base64 = imagePreview.dataUrl.split(',')[1];
      const mimeType = imagePreview.file.type;

      const response = await fetch(apiUrl('/api/vision/recognize'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType }),
      });

      if (!response.ok) throw new Error('识别失败');

      const result: VisionResult = await response.json();
      setVisionResult(result);
      return result;
    } catch (err) {
      console.error('[useImageRecognition] Failed:', err);
      return null;
    } finally {
      setIsRecognizing(false);
    }
  }, [imagePreview]);

  // 构建发送给 AI 的文本（图片识别结果 + 用户输入）
  const buildMessageWithVision = useCallback(
    (userText: string): string => {
      if (!visionResult) return userText;

      const entityText =
        visionResult.entities.length > 0
          ? `\n图片中识别到：${visionResult.entities.map((e) => `${e.name}(${e.type})`).join('、')}`
          : '';

      return `[图片识别] ${visionResult.text}${entityText}\n${userText}`;
    },
    [visionResult]
  );

  return {
    imagePreview,
    isRecognizing,
    visionResult,
    inputRef,
    selectImage,
    handleFileChange,
    removeImage,
    recognizeImage,
    buildMessageWithVision,
  };
}
