import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scan } from '../src/scanner/scanner';
import { DEFAULT_CONFIG } from '../src/scanner/rules';
import { isLargeFile, isOldFile } from '../src/scanner/rules';
import { getCategory } from '../src/scanner/categories';
import { hashFile } from '../src/utils/hash';
import { collectFileMetadata } from '../src/scanner/fileMetadata';
import { detectDuplicates } from '../src/scanner/duplicates';
import { formatBytes } from '../src/utils/formatBytes';
import { ScanConfig } from '../src/types/scanner';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Create a unique temporary directory for each test. */
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'grumpyduck-test-'));
}

/**
 * Write a file with given content and optionally set its mtime.
 */
function writeFile(dir: string, name: string, content: string, mtimeDaysAgo?: number): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, 'utf-8');
  if (mtimeDaysAgo !== undefined) {
    const t = new Date(Date.now() - mtimeDaysAgo * 24 * 60 * 60 * 1000);
    fs.utimesSync(filePath, t, t);
  }
  return filePath;
}

/** Write a file with exactly `sizeBytes` bytes of content. */
function writeFileOfSize(dir: string, name: string, sizeBytes: number): string {
  const filePath = path.join(dir, name);
  const buf = Buffer.alloc(sizeBytes, 'x');
  fs.writeFileSync(filePath, buf);
  return filePath;
}

/** Recursively remove a temp directory after a test. */
function cleanupTmpDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. File size detection
// ─────────────────────────────────────────────────────────────────────────────

describe('isLargeFile', () => {
  const config = DEFAULT_CONFIG;

  it('returns null for small files', () => {
    expect(isLargeFile(1024, config)).toBeNull();
    expect(isLargeFile(50 * 1024 * 1024, config)).toBeNull(); // 50 MB
  });

  it('returns Medium for files > 100 MB', () => {
    expect(isLargeFile(150 * 1024 * 1024, config)).toBe('Medium');
  });

  it('returns Large for files > 500 MB', () => {
    expect(isLargeFile(600 * 1024 * 1024, config)).toBe('Large');
  });

  it('returns Very Large for files > 1 GB', () => {
    expect(isLargeFile(2 * 1024 * 1024 * 1024, config)).toBe('Very Large');
  });

  it('respects custom thresholds', () => {
    const custom: ScanConfig = { ...config, mediumBytes: 1024, largeBytes: 2048, veryLargeBytes: 4096 };
    expect(isLargeFile(512, custom)).toBeNull();
    expect(isLargeFile(1500, custom)).toBe('Medium');
    expect(isLargeFile(3000, custom)).toBe('Large');
    expect(isLargeFile(5000, custom)).toBe('Very Large');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Old file detection
// ─────────────────────────────────────────────────────────────────────────────

describe('isOldFile', () => {
  const config = DEFAULT_CONFIG;
  const MS = 24 * 60 * 60 * 1000;

  it('returns null for recently modified files', () => {
    expect(isOldFile(Date.now() - 30 * MS, config)).toBeNull();
    expect(isOldFile(Date.now() - 179 * MS, config)).toBeNull();
  });

  it('returns Old for files modified 180–364 days ago', () => {
    expect(isOldFile(Date.now() - 200 * MS, config)).toBe('Old');
    expect(isOldFile(Date.now() - 364 * MS, config)).toBe('Old');
  });

  it('returns Very Old for files modified >= 365 days ago', () => {
    expect(isOldFile(Date.now() - 400 * MS, config)).toBe('Very Old');
    expect(isOldFile(Date.now() - 1000 * MS, config)).toBe('Very Old');
  });

  it('respects custom thresholds', () => {
    const custom: ScanConfig = { ...config, oldDays: 10, veryOldDays: 30 };
    expect(isOldFile(Date.now() - 5 * MS, custom)).toBeNull();
    expect(isOldFile(Date.now() - 15 * MS, custom)).toBe('Old');
    expect(isOldFile(Date.now() - 35 * MS, custom)).toBe('Very Old');
  });

  it('excludes build output, publish folders, and node_modules from old files', () => {
    const oldTime = Date.now() - 400 * MS;
    expect(isOldFile(oldTime, config, '/Downloads/publish/JetBrains.Annotations.dll', 'dll', 'Other')).toBeNull();
    expect(isOldFile(oldTime, config, '/Downloads/publish 2/Microsoft.Win32.SystemEvents.dll', 'dll', 'Other')).toBeNull();
    expect(isOldFile(oldTime, config, '/Downloads/node_modules/lodash/index.js', 'js', 'Code')).toBeNull();
    expect(isOldFile(oldTime, config, '/Downloads/bin/Debug/app.dll', 'dll', 'Other')).toBeNull();
  });

  it('excludes non-user system binary extensions (.dll, .pdb, .dylib, .so) from old files', () => {
    const oldTime = Date.now() - 400 * MS;
    expect(isOldFile(oldTime, config, '/Downloads/library.dll', 'dll', 'Other')).toBeNull();
    expect(isOldFile(oldTime, config, '/Downloads/symbols.pdb', 'pdb', 'Other')).toBeNull();
    expect(isOldFile(oldTime, config, '/Downloads/libnative.dylib', 'dylib', 'Other')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. File categorization
// ─────────────────────────────────────────────────────────────────────────────

describe('getCategory', () => {
  it('categorises images', () => {
    expect(getCategory('jpg')).toBe('Images');
    expect(getCategory('png')).toBe('Images');
    expect(getCategory('heic')).toBe('Images');
  });

  it('categorises videos', () => {
    expect(getCategory('mp4')).toBe('Videos');
    expect(getCategory('mkv')).toBe('Videos');
    expect(getCategory('webm')).toBe('Videos');
  });

  it('categorises audio', () => {
    expect(getCategory('mp3')).toBe('Audio');
    expect(getCategory('flac')).toBe('Audio');
  });

  it('categorises documents', () => {
    expect(getCategory('pdf')).toBe('Documents');
    expect(getCategory('docx')).toBe('Documents');
    expect(getCategory('md')).toBe('Documents');
  });

  it('categorises archives', () => {
    expect(getCategory('zip')).toBe('Archives');
    expect(getCategory('tar')).toBe('Archives');
    expect(getCategory('7z')).toBe('Archives');
  });

  it('categorises installers', () => {
    expect(getCategory('dmg')).toBe('Installers');
    expect(getCategory('iso')).toBe('Installers');
    expect(getCategory('exe')).toBe('Installers');
  });

  it('categorises code', () => {
    expect(getCategory('ts')).toBe('Code');
    expect(getCategory('py')).toBe('Code');
    expect(getCategory('rs')).toBe('Code');
  });

  it('returns Other for unknown extensions', () => {
    expect(getCategory('xyz')).toBe('Other');
    expect(getCategory('')).toBe('Other');
  });

  it('is case-insensitive', () => {
    expect(getCategory('JPG')).toBe('Images');
    expect(getCategory('PDF')).toBe('Documents');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Hash comparison
// ─────────────────────────────────────────────────────────────────────────────

describe('hashFile', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanupTmpDir(tmpDir); });

  it('produces consistent hashes for identical content', async () => {
    const a = writeFile(tmpDir, 'a.txt', 'hello world');
    const b = writeFile(tmpDir, 'b.txt', 'hello world');
    const hashA = await hashFile(a);
    const hashB = await hashFile(b);
    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it('produces different hashes for different content', async () => {
    const a = writeFile(tmpDir, 'a.txt', 'hello world');
    const b = writeFile(tmpDir, 'b.txt', 'goodbye world');
    expect(await hashFile(a)).not.toBe(await hashFile(b));
  });

  it('throws for non-existent files', async () => {
    await expect(hashFile('/does/not/exist.txt')).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Duplicate detection
// ─────────────────────────────────────────────────────────────────────────────

describe('detectDuplicates', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanupTmpDir(tmpDir); });

  it('detects files with identical content as duplicates', async () => {
    const pathA = writeFile(tmpDir, 'photo.png', 'binary-image-data-abc');
    const pathB = writeFile(tmpDir, 'photo-copy.png', 'binary-image-data-abc');

    const statsA = fs.statSync(pathA);
    const statsB = fs.statSync(pathB);

    const files = [
      collectFileMetadata(pathA, statsA),
      collectFileMetadata(pathB, statsB),
    ];

    const { groups } = await detectDuplicates(files);
    expect(groups).toHaveLength(1);
    expect(groups[0].files).toHaveLength(2);
  });

  it('does NOT flag files with same name but different content', async () => {
    const pathA = writeFile(tmpDir, 'file.txt', 'content-one');
    const pathB = writeFile(tmpDir, 'file-2.txt', 'content-two');

    const files = [
      collectFileMetadata(pathA, fs.statSync(pathA)),
      collectFileMetadata(pathB, fs.statSync(pathB)),
    ];

    const { groups } = await detectDuplicates(files);
    expect(groups).toHaveLength(0);
  });

  it('returns no groups for unique files', async () => {
    const paths = ['a.txt', 'b.txt', 'c.txt'].map((n, i) =>
      writeFile(tmpDir, n, `unique-content-${i}`),
    );
    const files = paths.map((p) => collectFileMetadata(p, fs.statSync(p)));
    const { groups } = await detectDuplicates(files);
    expect(groups).toHaveLength(0);
  });

  it('skips zero-byte files', async () => {
    const pathA = writeFile(tmpDir, 'empty1.txt', '');
    const pathB = writeFile(tmpDir, 'empty2.txt', '');
    const files = [
      collectFileMetadata(pathA, fs.statSync(pathA)),
      collectFileMetadata(pathB, fs.statSync(pathB)),
    ];
    const { groups } = await detectDuplicates(files);
    expect(groups).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Empty directory detection
// ─────────────────────────────────────────────────────────────────────────────

describe('Empty directory detection', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanupTmpDir(tmpDir); });

  it('detects a completely empty subdirectory', async () => {
    const emptyDir = path.join(tmpDir, 'empty-folder');
    fs.mkdirSync(emptyDir);
    // Put a file in the root so the scan has something to do
    writeFile(tmpDir, 'root.txt', 'hello');

    const result = await scan(tmpDir, DEFAULT_CONFIG);
    expect(result.emptyDirectories).toContain(emptyDir);
  });

  it('does not flag non-empty directories', async () => {
    const subDir = path.join(tmpDir, 'has-files');
    fs.mkdirSync(subDir);
    writeFile(subDir, 'file.txt', 'content');

    const result = await scan(tmpDir, DEFAULT_CONFIG);
    expect(result.emptyDirectories).not.toContain(subDir);
  });

  it('handles multiply-nested empty directories', async () => {
    const nested = path.join(tmpDir, 'a', 'b', 'c');
    fs.mkdirSync(nested, { recursive: true });
    writeFile(tmpDir, 'anchor.txt', 'x');

    const result = await scan(tmpDir, DEFAULT_CONFIG);
    // All three nested dirs should be empty
    expect(result.emptyDirectories).toContain(nested);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Permission error handling
// ─────────────────────────────────────────────────────────────────────────────

describe('Permission error handling', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => {
    // Restore permissions before cleanup so rmSync can delete
    try {
      const locked = path.join(tmpDir, 'locked-dir');
      if (fs.existsSync(locked)) fs.chmodSync(locked, 0o755);
    } catch { /* ignore */ }
    cleanupTmpDir(tmpDir);
  });

  it('continues scanning when a directory is not readable', async () => {
    // Create a file we CAN read
    writeFile(tmpDir, 'readable.txt', 'ok');

    // Create a directory with no read permission
    const lockedDir = path.join(tmpDir, 'locked-dir');
    fs.mkdirSync(lockedDir);
    writeFile(lockedDir, 'secret.txt', 'secret');
    fs.chmodSync(lockedDir, 0o000);

    // Skip on CI / root where permissions may be ignored
    const canCheck = (() => {
      try { fs.readdirSync(lockedDir); return false; } catch { return true; }
    })();

    if (!canCheck) return; // permission enforcement not available, skip

    const result = await scan(tmpDir, DEFAULT_CONFIG);

    // The scan should not throw, and should record an error for the locked dir
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.code === 'EACCES')).toBe(true);

    // The readable file should still be in results
    expect(result.files.some((f) => f.name === 'readable.txt')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Unicode filenames
// ─────────────────────────────────────────────────────────────────────────────

describe('Unicode filenames', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanupTmpDir(tmpDir); });

  it('handles unicode characters in filenames', async () => {
    const names = [
      '日本語ファイル.txt',
      'Ünïcödé.pdf',
      'emoji-🦆-file.jpg',
      'arabic-مرحبا.doc',
      'chinese-文件.zip',
    ];

    for (const name of names) {
      writeFile(tmpDir, name, `content of ${name}`);
    }

    const result = await scan(tmpDir, DEFAULT_CONFIG);
    for (const name of names) {
      expect(result.files.some((f) => f.name === name)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Nested directories
// ─────────────────────────────────────────────────────────────────────────────

describe('Nested directories', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanupTmpDir(tmpDir); });

  it('recursively scans nested directories', async () => {
    const deep = path.join(tmpDir, 'a', 'b', 'c', 'd');
    fs.mkdirSync(deep, { recursive: true });
    writeFile(deep, 'deep-file.txt', 'deep content');
    writeFile(tmpDir, 'root-file.txt', 'root content');

    const result = await scan(tmpDir, DEFAULT_CONFIG);

    const names = result.files.map((f) => f.name);
    expect(names).toContain('deep-file.txt');
    expect(names).toContain('root-file.txt');
  });

  it('counts all intermediate directories', async () => {
    fs.mkdirSync(path.join(tmpDir, 'level1', 'level2'), { recursive: true });
    writeFile(path.join(tmpDir, 'level1', 'level2'), 'file.txt', 'content');

    const result = await scan(tmpDir, DEFAULT_CONFIG);
    // Should have found level1 and level2 directories
    expect(result.summary.totalDirectories).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Symbolic links
// ─────────────────────────────────────────────────────────────────────────────

describe('Symbolic links', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanupTmpDir(tmpDir); });

  it('does NOT follow symlinks by default (followSymlinks: false)', async () => {
    const real = writeFile(tmpDir, 'real.txt', 'real content');
    const link = path.join(tmpDir, 'link.txt');
    try {
      fs.symlinkSync(real, link);
    } catch {
      return; // symlinks not supported on this system, skip
    }

    const result = await scan(tmpDir, { ...DEFAULT_CONFIG, followSymlinks: false });
    // The symlink should NOT appear as a scanned file
    expect(result.files.some((f) => f.name === 'link.txt')).toBe(false);
    // The real file should appear
    expect(result.files.some((f) => f.name === 'real.txt')).toBe(true);
  });

  it('handles broken symbolic links gracefully', async () => {
    const link = path.join(tmpDir, 'broken-link.txt');
    try {
      fs.symlinkSync('/does/not/exist.txt', link);
    } catch {
      return; // symlinks not supported on this system, skip
    }

    // Should not throw — broken symlinks are silently ignored when not following
    const result = await scan(tmpDir, { ...DEFAULT_CONFIG, followSymlinks: false });
    expect(result).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Full scan integration
// ─────────────────────────────────────────────────────────────────────────────

describe('Full scan integration', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanupTmpDir(tmpDir); });

  it('returns correct schema version', async () => {
    writeFile(tmpDir, 'file.txt', 'hello');
    const result = await scan(tmpDir, DEFAULT_CONFIG);
    expect(result.schemaVersion).toBe('1.0.0');
  });

  it('populates startedAt and completedAt as ISO strings', async () => {
    writeFile(tmpDir, 'file.txt', 'hello');
    const result = await scan(tmpDir, DEFAULT_CONFIG);
    expect(() => new Date(result.startedAt)).not.toThrow();
    expect(() => new Date(result.completedAt)).not.toThrow();
  });

  it('detects large files in scan result', async () => {
    const config: ScanConfig = { ...DEFAULT_CONFIG, mediumBytes: 10, largeBytes: 20, veryLargeBytes: 30 };
    writeFileOfSize(tmpDir, 'big.bin', 25);
    writeFile(tmpDir, 'small.txt', 'tiny');

    const result = await scan(tmpDir, config);
    const bigFile = result.files.find((f) => f.name === 'big.bin');
    expect(bigFile).toBeDefined();
    expect(bigFile?.sizeLabel).toBe('Large');

    const smallFile = result.files.find((f) => f.name === 'small.txt');
    expect(smallFile?.sizeLabel).toBeNull();
  });

  it('detects old files in scan result', async () => {
    const config: ScanConfig = { ...DEFAULT_CONFIG, oldDays: 5, veryOldDays: 10 };
    writeFile(tmpDir, 'new.txt', 'new', 2);   // 2 days ago
    writeFile(tmpDir, 'old.txt', 'old', 7);   // 7 days ago

    const result = await scan(tmpDir, config);
    const newFile = result.files.find((f) => f.name === 'new.txt');
    const oldFile = result.files.find((f) => f.name === 'old.txt');

    expect(newFile?.ageLabel).toBeNull();
    expect(oldFile?.ageLabel).toBe('Old');
  });

  it('includes summary with correct totals', async () => {
    writeFile(tmpDir, 'a.txt', '12345');
    writeFile(tmpDir, 'b.jpg', '12345');

    const result = await scan(tmpDir, DEFAULT_CONFIG);
    expect(result.summary.totalFiles).toBe(2);
    expect(result.summary.totalBytes).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. formatBytes utility
// ─────────────────────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. macOS Application Bundle Improvements
// ─────────────────────────────────────────────────────────────────────────────

describe('macOS Application Bundle Improvements', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanupTmpDir(tmpDir); });

  it('Test 1 — treats .app bundle as 1 logical application item and ignores internal files from cleanup', async () => {
    const appDir = path.join(tmpDir, 'TestApp.app');
    const contentsDir = path.join(appDir, 'Contents', 'Resources');
    fs.mkdirSync(contentsDir, { recursive: true });

    // Internal files with old mtime
    writeFile(contentsDir, 'Info.plist', '<plist></plist>', 400);
    writeFile(contentsDir, 'App.icns', 'icon-bytes', 400);

    const result = await scan(tmpDir, DEFAULT_CONFIG);

    expect(result.applications).toHaveLength(1);
    expect(result.applications[0].name).toBe('TestApp.app');
    expect(result.applications[0].category).toBe('Applications');

    // 0 old internal files, 0 empty internal folders, 0 internal duplicate groups
    expect(result.summary.oldFileCount).toBe(0);
    expect(result.emptyDirectories).not.toContain(path.join(appDir, 'Contents'));
    expect(result.duplicateGroups).toHaveLength(0);

    // Internal files must NOT appear in files list
    expect(result.files.some((f) => f.name === 'Info.plist')).toBe(false);
  });

  it('Test 2 — scans normal folders normally', async () => {
    const downloads = path.join(tmpDir, 'Downloads');
    fs.mkdirSync(downloads);
    writeFile(downloads, 'document.pdf', 'pdf data');
    writeFile(downloads, 'photo.jpg', 'jpg data');
    writeFile(downloads, 'old.zip', 'zip data', 200);

    const result = await scan(downloads, DEFAULT_CONFIG);

    expect(result.summary.totalFiles).toBe(3);
    expect(result.summary.oldFileCount).toBe(1);
    expect(result.files.some((f) => f.name === 'document.pdf')).toBe(true);
  });

  it('Test 3 — handles application plus normal files without inflating category counts', async () => {
    const downloads = path.join(tmpDir, 'Downloads');
    const appDir = path.join(downloads, 'VSCode.app', 'Contents', 'Resources');
    fs.mkdirSync(appDir, { recursive: true });
    writeFile(appDir, 'Info.plist', 'info');
    writeFile(appDir, 'main.js', 'console.log("code");');

    writeFile(downloads, 'project.pdf', 'pdf content');

    const result = await scan(downloads, DEFAULT_CONFIG);

    const appCategory = result.summary.categories.find((c) => c.category === 'Applications');
    const docCategory = result.summary.categories.find((c) => c.category === 'Documents');
    const codeCategory = result.summary.categories.find((c) => c.category === 'Code');

    expect(appCategory?.count).toBe(1);
    expect(docCategory?.count).toBe(1);
    expect(codeCategory).toBeUndefined(); // main.js inside VSCode.app must not count
  });

  it('Test 4 — detects duplicate normal files with 1 extra copy', async () => {
    writeFile(tmpDir, 'file.pdf', 'identical-pdf-content');
    writeFile(tmpDir, 'file-copy.pdf', 'identical-pdf-content');

    const result = await scan(tmpDir, DEFAULT_CONFIG);

    expect(result.duplicateGroups).toHaveLength(1);
    expect(result.summary.duplicateWastedBytes).toBe(Buffer.byteLength('identical-pdf-content'));
  });

  it('Test 5 — excludes duplicate application internals across apps', async () => {
    const app1 = path.join(tmpDir, 'App1.app', 'Contents');
    const app2 = path.join(tmpDir, 'App2.app', 'Contents');
    fs.mkdirSync(app1, { recursive: true });
    fs.mkdirSync(app2, { recursive: true });

    // Identical Info.plist inside two different apps
    writeFile(app1, 'Info.plist', 'same-plist');
    writeFile(app2, 'Info.plist', 'same-plist');

    const result = await scan(tmpDir, DEFAULT_CONFIG);

    expect(result.duplicateGroups).toHaveLength(0);
  });

  it('Test 6 — ignores empty subdirectories inside application bundles', async () => {
    const appDir = path.join(tmpDir, 'App.app', 'Contents', 'EmptyFolder');
    fs.mkdirSync(appDir, { recursive: true });
    writeFile(tmpDir, 'outside.txt', 'outside');

    const result = await scan(tmpDir, DEFAULT_CONFIG);

    expect(result.emptyDirectories).not.toContain(appDir);
    expect(result.emptyDirectories).not.toContain(path.join(tmpDir, 'App.app', 'Contents'));
  });
});
