/**
 * Return a human-readable relative age string for a past timestamp.
 *
 * Examples:
 *   relativeAge(Date.now() - 30 * 86400 * 1000)  → '30 days ago'
 *   relativeAge(Date.now() - 400 * 86400 * 1000) → '1 year ago'
 */
export declare function relativeAge(timestampMs: number): string;
/**
 * Format a millisecond timestamp as a locale date string.
 * Example: formatDate(1700000000000) → '11/14/2023'
 */
export declare function formatDate(timestampMs: number): string;
//# sourceMappingURL=formatDate.d.ts.map