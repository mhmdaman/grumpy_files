"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashFile = hashFile;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
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
function hashFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = (0, crypto_1.createHash)('sha256');
        const stream = (0, fs_1.createReadStream)(filePath, {
            // Read in 256 KB chunks — a reasonable balance between memory usage
            // and syscall overhead for large files.
            highWaterMark: 256 * 1024,
        });
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}
//# sourceMappingURL=hash.js.map