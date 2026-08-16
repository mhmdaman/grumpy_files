import { ScanResult } from '../types/scanner';
/**
 * Serialise a ScanResult to a formatted JSON string.
 *
 * The result includes all data needed to reconstruct any view in the future
 * Tauri desktop UI without re-scanning.
 */
export declare function toJSON(result: ScanResult): string;
/**
 * Write a JSON report.
 *
 * @param result   The completed ScanResult.
 * @param outPath  Optional file path. If omitted, the JSON is written to stdout.
 */
export declare function writeJSONReport(result: ScanResult, outPath?: string): Promise<void>;
//# sourceMappingURL=jsonReport.d.ts.map