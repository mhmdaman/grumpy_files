/**
 * Compute a SHA-256 hex digest for a file using a readable stream.
 *
 * Streaming avoids loading the entire file into memory, which is critical
 * when scanning multi-gigabyte files.
 *
 * @param filePath  Absolute path to the file.
 * @returns         Hex-encoded SHA-256 digest.
 * @throws          If the file cannot be read (EACCES, ENOENT, etc.).
 */
export declare function hashFile(filePath: string): Promise<string>;
//# sourceMappingURL=hash.d.ts.map