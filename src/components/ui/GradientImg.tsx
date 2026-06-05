import React, { useState, useEffect } from 'react';

const gradientMap: Record<string, string> = {
  'gradient:blue-purple': 'from-[#dde8f8] to-[#ece2f7]',
  'gradient:orange-red': 'from-[#ffe8d8] to-[#ffd8d2]',
  'gradient:green-teal': 'from-[#e2f4eb] to-[#dceff2]',
  'gradient:indigo-blue': 'from-[#e4ebf8] to-[#dce7f4]',
  'gradient:pink-yellow': 'from-[#fde5ef] to-[#fff1d5]',
  'gradient:purple-pink': 'from-[#eee3f7] to-[#f9dfea]',
  'gradient:orange-amber': 'from-[#ffe9d7] to-[#fff0dc]',
  'gradient:yellow-green': 'from-[#fff4df] to-[#e6f3e2]',
  'gradient:blue-indigo': 'from-[#dfe9f8] to-[#e7e3f7]',
  'gradient:red-orange': 'from-[#ffe2de] to-[#ffe9d9]',
};

const fallbackKey = 'gradient:blue-purple';

interface GradientImgProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'alt'> {
  src?: string;
  alt?: string;
}

export default function GradientImg({
  src,
  className = '',
  alt,
  style,
  ...props
}: GradientImgProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const isGradient = (src && gradientMap[src]) || !src;
  const isSvgDataUrl = src && src.startsWith('data:image/svg');
  const isBrokenUrl = src && !gradientMap[src] && src.startsWith('http') && hasError;
  const isDataOrGradientKey = src && src.startsWith('gradient:');
  const isRealImage = src && !gradientMap[src] && !hasError && !isDataOrGradientKey && !isSvgDataUrl;

  if (isGradient || isBrokenUrl || isDataOrGradientKey || isSvgDataUrl) {
    const gradientKey = (src && gradientMap[src]) ? src : fallbackKey;
    return (
      <div
        className={`bg-gradient-to-br ${gradientMap[gradientKey]} ${className}`}
        style={style}
        role="img"
        aria-label={alt}
      />
    );
  }

  if (isRealImage) {
    return (
      <img
        src={src}
        alt={alt || ''}
        className={className}
        style={style}
        loading="lazy"
        onError={() => setHasError(true)}
        {...props}
      />
    );
  }

  return (
    <div
      className={`bg-gradient-to-br ${gradientMap[fallbackKey]} ${className}`}
      style={style}
      role="img"
      aria-label={alt}
    />
  );
}
