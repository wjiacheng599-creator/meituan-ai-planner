export function hashText(input: string): number {
  if (!input) return 0;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function seededInt(input: string, min: number, max: number): number {
  const ratio = (hashText(input) % 1000) / 1000;
  return Math.round(min + (max - min) * ratio);
}

export function seededFloat(input: string, min: number, max: number, digits = 1): number {
  const ratio = (hashText(input) % 1000) / 1000;
  return Number((min + (max - min) * ratio).toFixed(digits));
}

export function seededPhone(input: string, prefix: string): string {
  return `${prefix}${String(seededInt(input, 1000, 9999)).padStart(4, '0')}`;
}
