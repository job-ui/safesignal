import { Timestamp } from 'firebase/firestore';

export function computeStatus(
  lastSeen: Timestamp,
  thresholdHours: number
): 'safe' | 'warn' | 'danger' {
  const now = Date.now();
  const thresholdMs = thresholdHours * 3_600_000;
  const elapsed = now - lastSeen.toMillis();

  if (elapsed <= thresholdMs) return 'safe';
  if (elapsed < thresholdMs * 1.5) return 'warn';
  return 'danger';
}

export function formatTimeAgo(timestamp: Timestamp): string {
  return formatTimeAgoMs(timestamp.toMillis());
}

export function formatTimeAgoMs(ms: number): string {
  const elapsed = Date.now() - ms;
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(elapsed / 3_600_000);
  const days = Math.floor(elapsed / 86_400_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
