export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ignore
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export async function shareText(payload: {
  title: string;
  text: string;
  url?: string;
}): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share(payload);
      return true;
    }
  } catch {
    return false;
  }

  return copyText([payload.title, payload.text, payload.url].filter(Boolean).join('\n'));
}

export function openMapSearch(keyword: string) {
  const url = `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}&src=openai`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function downloadSvgPoster(filename: string, lines: string[]) {
  const safeLines = lines.map((line) =>
    line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  );

  const lineSvg = safeLines
    .map(
      (line, index) =>
        `<text x="48" y="${170 + index * 34}" font-size="22" font-family="Arial, sans-serif" fill="#1f2937">${line}</text>`
    )
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff7d1"/>
          <stop offset="50%" stop-color="#fff2e2"/>
          <stop offset="100%" stop-color="#f7f8fa"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#bg)"/>
      <rect x="36" y="36" width="1008" height="1848" rx="48" fill="white" opacity="0.96"/>
      <text x="48" y="96" font-size="28" font-family="Arial, sans-serif" fill="#f59e0b">AI 行程</text>
      ${lineSvg}
    </svg>
  `;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
