import { createHash } from 'crypto';
import { createReadStream } from 'fs';

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
export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath, {
      // Read in 256 KB chunks — a reasonable balance between memory usage
      // and syscall overhead for large files.
      highWaterMark: 256 * 1024,
    });

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
