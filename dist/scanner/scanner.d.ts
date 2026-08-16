import { ScanConfig, ScanResult } from '../types/scanner';
/**
 * Scan a directory recursively, collecting file metadata and running all
 * analysis rules.
 *
 * SAFETY: This function is strictly read-only. It calls fs.readdir and
 * fs.stat — no write operations are ever performed.
 *
 * @param rootDir  Absolute path to the directory to scan.
 * @param config   Scan configuration (thresholds, symlink behaviour, etc.).
 * @returns        Complete ScanResult ready for any reporter.
 */
export declare function scan(rootDir: string, config: ScanConfig): Promise<ScanResult>;
//# sourceMappingURL=scanner.d.ts.map