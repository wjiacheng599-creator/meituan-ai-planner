export function formatCount(count: number): string {
  if (count >= 10000) return (count / 10000).toFixed(1) + 'w';
  return count.toString();
}

export function getAvatarUrl(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
}

export function generateOrderId(): string {
  return (
    Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase()
  );
}

export function seededRating(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return (4.0 + (Math.abs(hash) % 100) / 100).toFixed(1);
}
