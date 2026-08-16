import { FileCategory } from '../types/scanner';
declare const EXTENSION_MAP: Record<string, FileCategory>;
export declare const DEFAULT_BUNDLE_EXTENSIONS: string[];
/**
 * Check whether a directory name matches a package/bundle extension (e.g. "VSCode.app").
 */
export declare function isBundleDirectory(dirName: string, bundleExtensions?: string[]): boolean;
/**
 * Determine the FileCategory for a given file extension.
 *
 * @param extension  Lower-cased extension WITHOUT a leading dot.
 *                   Pass an empty string for files with no extension.
 * @returns          The matching FileCategory, or 'Other' for unknown extensions.
 */
export declare function getCategory(extension: string): FileCategory;
export { EXTENSION_MAP };
//# sourceMappingURL=categories.d.ts.map