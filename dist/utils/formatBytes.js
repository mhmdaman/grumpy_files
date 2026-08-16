"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatBytes = formatBytes;
exports.formatNumber = formatNumber;
/**
 * Convert a number of bytes into a human-readable string.
 *
 * Examples:
 *   formatBytes(0)           → '0 B'
 *   formatBytes(1024)        → '1.00 KB'
 *   formatBytes(1073741824)  → '1.00 GB'
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    return `${value.toFixed(decimals)} ${sizes[i]}`;
}
/**
 * Format a number with thousands separators.
 * Example: formatNumber(1284) → '1,284'
 */
function formatNumber(n) {
    return n.toLocaleString('en-US');
}
//# sourceMappingURL=formatBytes.js.map