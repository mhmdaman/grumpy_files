import { Stats } from 'fs';
import { FileMetadata } from '../types/scanner';
/**
 * Build a FileMetadata object from a file path and its fs.Stats.
 *
 * This function is deliberately pure (no filesystem calls) so that it can
 * be called with mock stats in tests.
 *
 * @param filePath  Absolute path to the file.
 * @param stats     fs.Stats returned by fs.stat() — never lstat, so symlinks
 *                  are resolved to their targets. The caller controls whether
 *                  symlinks are followed.
 * @returns         Populated FileMetadata with analysis flags initialised to null.
 */
export declare function collectFileMetadata(filePath: string, stats: Stats): FileMetadata;
//# sourceMappingURL=fileMetadata.d.ts.map