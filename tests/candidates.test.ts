import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scan } from '../src/scanner/scanner';
import { DEFAULT_CONFIG } from '../src/scanner/rules';
import { extractCleanupCandidates } from '../src/scanner/candidates';
import { CleanupCandidate } from '../src/types/candidates';

describe('Cleanup Candidates & Duplicate Review System', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grumpyduck-candidates-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates structured candidates conforming to CleanupCandidate interface', async () => {
    // Create duplicate files
    const file1 = path.join(tempDir, 'Module_2_AC.pptx');
    const file2 = path.join(tempDir, 'Module_2_AC (1).pptx');
    const file3 = path.join(tempDir, 'Module_2_AC (2).pptx');
    const content = 'Identical presentation content for duplicate verification';
    fs.writeFileSync(file1, content);
    fs.writeFileSync(file2, content);
    fs.writeFileSync(file3, content);

    // Create an installer
    const installerFile = path.join(tempDir, 'Docker.dmg');
    fs.writeFileSync(installerFile, 'Mock installer binary');

    // Create an empty folder
    const emptyFolder = path.join(tempDir, 'EmptySubFolder');
    fs.mkdirSync(emptyFolder);

    const scanResult = await scan(tempDir, DEFAULT_CONFIG);
    const cleanupPayload = extractCleanupCandidates(scanResult);

    expect(cleanupPayload.scannedPath).toBe(tempDir);
    expect(cleanupPayload.candidates.length).toBeGreaterThan(0);

    // Check that each candidate matches the CleanupCandidate interface
    for (const candidate of cleanupPayload.candidates) {
      expect(typeof candidate.path).toBe('string');
      expect(typeof candidate.name).toBe('string');
      expect(['DUPLICATE', 'INSTALLER', 'LARGE_FILE', 'OLD_FILE', 'EMPTY_FOLDER']).toContain(candidate.category);
      expect(['KEEP', 'REVIEW', 'POTENTIAL_CLEANUP']).toContain(candidate.recommendation);
      expect(typeof candidate.reason).toBe('string');
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(candidate.confidence);
    }
  });

  it('marks duplicate original as KEEP and redundant copies as POTENTIAL_CLEANUP with accurate wasted bytes', async () => {
    const fileA = path.join(tempDir, 'Report.pdf');
    const fileB = path.join(tempDir, 'Report (Copy).pdf');
    const fileC = path.join(tempDir, 'Report_final.pdf');
    const pdfData = Buffer.alloc(1024 * 50, 'A'); // 50 KB

    fs.writeFileSync(fileA, pdfData);
    fs.writeFileSync(fileB, pdfData);
    fs.writeFileSync(fileC, pdfData);

    const scanResult = await scan(tempDir, DEFAULT_CONFIG);
    const cleanupPayload = extractCleanupCandidates(scanResult);

    expect(cleanupPayload.duplicateGroups.length).toBe(1);
    const group = cleanupPayload.duplicateGroups[0];

    // Original should be recommended to KEEP
    expect(group.original.recommendation).toBe('KEEP');
    expect(group.original.isDuplicateOriginal).toBe(true);
    expect(group.original.category).toBe('DUPLICATE');
    expect(group.original.confidence).toBe('HIGH');

    // Duplicate copies should be recommended for POTENTIAL_CLEANUP
    expect(group.duplicates.length).toBe(2);
    for (const dup of group.duplicates) {
      expect(dup.recommendation).toBe('POTENTIAL_CLEANUP');
      expect(dup.isDuplicateOriginal).toBe(false);
      expect(dup.confidence).toBe('HIGH');
    }

    // Wasted bytes: 2 extra copies * 50 KB = 100 KB
    expect(group.wastedBytes).toBe(50 * 1024 * 2);
    expect(cleanupPayload.summary.totalDuplicateWastedBytes).toBe(50 * 1024 * 2);
  });

  it('conservatively marks installers as REVIEW (not automatically delete)', async () => {
    const installerPath = path.join(tempDir, 'GoogleChrome.pkg');
    fs.writeFileSync(installerPath, Buffer.alloc(1024 * 100, 0));

    const scanResult = await scan(tempDir, DEFAULT_CONFIG);
    const cleanupPayload = extractCleanupCandidates(scanResult);

    const installerCandidate = cleanupPayload.candidates.find((c) => c.name === 'GoogleChrome.pkg');
    expect(installerCandidate).toBeDefined();
    expect(installerCandidate?.category).toBe('INSTALLER');
    expect(installerCandidate?.recommendation).toBe('REVIEW');
    expect(installerCandidate?.confidence).toBe('HIGH');
  });

  it('detects empty directories as EMPTY_FOLDER with REVIEW recommendation', async () => {
    const emptySubDir = path.join(tempDir, 'OldEmptyProject');
    fs.mkdirSync(emptySubDir);

    const scanResult = await scan(tempDir, DEFAULT_CONFIG);
    const cleanupPayload = extractCleanupCandidates(scanResult);

    const emptyCandidate = cleanupPayload.candidates.find((c) => c.name === 'OldEmptyProject');
    expect(emptyCandidate).toBeDefined();
    expect(emptyCandidate?.category).toBe('EMPTY_FOLDER');
    expect(emptyCandidate?.recommendation).toBe('REVIEW');
  });

  it('filters out system protected paths from candidates', async () => {
    const mockScanResult: any = {
      scannedPath: tempDir,
      completedAt: new Date().toISOString(),
      duplicateGroups: [
        {
          hash: 'abc',
          size: 1000,
          files: [
            { path: '/System/Library/CoreServices/Finder.app', name: 'Finder.app', size: 1000 },
            { path: path.join(tempDir, 'UserCopy.txt'), name: 'UserCopy.txt', size: 1000 },
          ],
        },
      ],
      files: [],
      emptyDirectories: [],
      summary: {
        totalFiles: 2,
        totalBytes: 2000,
        duplicateGroupCount: 1,
        duplicateWastedBytes: 1000,
      },
    };

    const payload = extractCleanupCandidates(mockScanResult);
    // Protected path /System/... should not be added as a duplicate cleanup candidate
    const protectedCandidate = payload.candidates.find((c) => c.path.startsWith('/System'));
    expect(protectedCandidate).toBeUndefined();
  });

  it('supports selecting multiple cleanup targets excluding KEEP originals', async () => {
    const fileA = path.join(tempDir, 'photo.png');
    const fileB = path.join(tempDir, 'photo (1).png');
    const installer = path.join(tempDir, 'setup.dmg');

    fs.writeFileSync(fileA, 'data');
    fs.writeFileSync(fileB, 'data');
    fs.writeFileSync(installer, 'installer binary');

    const scanResult = await scan(tempDir, DEFAULT_CONFIG);
    const payload = extractCleanupCandidates(scanResult);

    // Filter all selectable candidates (recommendation !== KEEP)
    const selectable = payload.candidates.filter((c) => c.recommendation !== 'KEEP');
    expect(selectable.length).toBe(2); // 1 duplicate extra copy + 1 installer
    const selectableNames = selectable.map((c) => c.name);
    expect(selectableNames.some((n) => n.startsWith('photo'))).toBe(true);
    expect(selectableNames).toContain('setup.dmg');
  });
});
