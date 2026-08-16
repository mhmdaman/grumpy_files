/**
 * Return a human-readable relative age string for a past timestamp.
 *
 * Examples:
 *   relativeAge(Date.now() - 30 * 86400 * 1000)  → '30 days ago'
 *   relativeAge(Date.now() - 400 * 86400 * 1000) → '1 year ago'
 */
export function relativeAge(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/**
 * Format a millisecond timestamp as a locale date string.
 * Example: formatDate(1700000000000) → '11/14/2023'
 */
export function formatDate(timestampMs: number): string {
  if (!timestampMs) return 'unknown';
  return new Date(timestampMs).toLocaleDateString('en-US');
}
