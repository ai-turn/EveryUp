/**
 * Check if a string is valid JSON
 */
export function isJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format JSON string with indentation
 */
export function formatJSON(str: string, indent: number = 2): string {
  try {
    return JSON.stringify(JSON.parse(str), null, indent);
  } catch {
    return str;
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

interface RelativeTimeLabels {
  justNow?: string;
  minutesAgo?: (count: number) => string;
  hoursAgo?: (count: number) => string;
  daysAgo?: (count: number) => string;
}

/**
 * Human-readable relative time (e.g. "3m ago", "2h ago")
 */
export function relativeTime(dateStr: string, labels: RelativeTimeLabels = {}): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return labels.justNow ?? 'Just now';
  if (mins < 60) return labels.minutesAgo?.(mins) ?? `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return labels.hoursAgo?.(hours) ?? `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return labels.daysAgo?.(days) ?? `${days}d ago`;
}
