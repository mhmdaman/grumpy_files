import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scan } from '../src/scanner/scanner';
import { DEFAULT_CONFIG } from '../src/scanner/rules';
import { extractReviewCandidates } from '../src/review/reviewer';
import { ReviewSession } from '../src/review/session';
import { buildCleanupPlan, writeCleanupPlan } from '../src/review/export';
import { FileMetadata } from '../src/types/scanner';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'grumpyduck-review-test-'));
}

function cleanupTmpDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('Phase 3: Interactive Review & Cleanup Planning', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanupTmpDir(tmpDir); });

  it('1. Extracts prioritized review candidates without modifying filesystem', async () => {
    // Create duplicate files
    fs.writeFileSync(path.join(tmpDir, 'file.pdf'), 'same-pdf-content');
    fs.writeFileSync(path.join(tmpDir, 'file-copy.pdf'), 'same-pdf-content');

    // Create installer in downloads
    const downloadsDir = path.join(tmpDir, 'Downloads');
    fs.mkdirSync(downloadsDir);
    fs.writeFileSync(path.join(downloadsDir, 'googlechrome.dmg'), 'dmg-content');

    // Create old dataset (should NOT be a cleanup candidate)
    const oldTime = Date.now() - 400 * 24 * 60 * 60 * 1000;
    const datasetPath = path.join(tmpDir, 'UNSW-NB15_training-set.csv');
    fs.writeFileSync(datasetPath, 'a,b,c');
    fs.utimesSync(datasetPath, new Date(oldTime), new Date(oldTime));

    // Create dev artifact (node_modules) (should NOT be a review candidate)
    const nodeModulesDir = path.join(tmpDir, 'node_modules', 'pkg');
    fs.mkdirSync(nodeModulesDir, { recursive: true });
    fs.writeFileSync(path.join(nodeModulesDir, 'index.js'), 'console.log()');

    const scanResult = await scan(tmpDir, DEFAULT_CONFIG);
    const candidates = extractReviewCandidates(scanResult);

    // Verify candidates
    expect(candidates.length).toBeGreaterThanOrEqual(2);

    // Exactly 1 duplicate extra copy should be candidate, not both
    const dupCandidates = candidates.filter((c) => c.priority === 'DUPLICATE_EXTRA');
    expect(dupCandidates).toHaveLength(1);
    expect(dupCandidates[0].isDuplicateExtra).toBe(true);

    // Installer candidate should be present
    const installerCandidate = candidates.find((c) => c.priority === 'INSTALLER');
    expect(installerCandidate).toBeDefined();
    expect(installerCandidate?.file.name).toBe('googlechrome.dmg');

    // Dataset and node_modules index.js should NOT be in review candidates
    expect(candidates.some((c) => c.file.name === 'UNSW-NB15_training-set.csv')).toBe(false);
    expect(candidates.some((c) => c.file.name === 'index.js')).toBe(false);

    // Invariant: all files still exist unchanged on disk
    expect(fs.existsSync(path.join(tmpDir, 'file.pdf'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'file-copy.pdf'))).toBe(true);
    expect(fs.existsSync(datasetPath)).toBe(true);
  });

  it('2. ReviewSession tracks in-memory state and decisions correctly', () => {
    const mockFile1: FileMetadata = {
      name: 'dup1.pdf',
      path: '/tmp/dup1.pdf',
      extension: 'pdf',
      size: 1000,
      createdAt: 0,
      modifiedAt: 0,
      accessedAt: 0,
      category: 'Documents',
      isHidden: false,
      parent: '/tmp',
      sizeLabel: null,
      ageLabel: null,
      hash: 'hash1',
    };
    const mockFile2: FileMetadata = {
      name: 'installer.dmg',
      path: '/tmp/installer.dmg',
      extension: 'dmg',
      size: 5000,
      createdAt: 0,
      modifiedAt: 0,
      accessedAt: 0,
      category: 'Installers',
      isHidden: false,
      parent: '/tmp',
      sizeLabel: null,
      ageLabel: null,
      hash: null,
    };

    const session = new ReviewSession([
      { file: mockFile1, priority: 'DUPLICATE_EXTRA', isDuplicateExtra: true },
      { file: mockFile2, priority: 'INSTALLER', isDuplicateExtra: false },
    ]);

    expect(session.getState().totalCandidates).toBe(2);
    expect(session.getState().reviewedCount).toBe(0);

    // Decision 1: Mark dup1.pdf for CLEANUP
    session.recordDecision('CLEANUP');
    expect(session.getState().cleanupCount).toBe(1);
    expect(session.getState().potentialCleanupBytes).toBe(1000);

    // Decision 2: KEEP installer.dmg
    session.recordDecision('KEEP');
    expect(session.getState().keptCount).toBe(1);
    expect(session.getState().remainingCount).toBe(0);
    expect(session.getState().reviewedCount).toBe(2);

    expect(session.getCleanupItems()).toHaveLength(1);
    expect(session.getCleanupItems()[0].file.name).toBe('dup1.pdf');
  });

  it('3. Exports valid cleanup plan JSON without touching original files', async () => {
    const mockFile: FileMetadata = {
      name: 'old-doc.pdf',
      path: path.join(tmpDir, 'old-doc.pdf'),
      extension: 'pdf',
      size: 2048,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      accessedAt: Date.now(),
      category: 'Documents',
      isHidden: false,
      parent: tmpDir,
      sizeLabel: null,
      ageLabel: 'Old',
      hash: null,
      intelligence: {
        classification: { type: 'DOCUMENT', confidence: 0.9 },
        confidenceLevel: 'High',
        recommendation: { action: 'REVIEW', reason: 'Old document', reasons: ['Old document'] },
        observations: ['OLD'],
        isDuplicate: false,
      },
    };

    fs.writeFileSync(mockFile.path, 'doc-data');

    const session = new ReviewSession([
      { file: mockFile, priority: 'OTHER_REVIEW', isDuplicateExtra: false },
    ]);

    session.recordDecision('CLEANUP');

    const plan = buildCleanupPlan(session, tmpDir);
    expect(plan.readOnly).toBe(true);
    expect(plan.summary.cleanupCount).toBe(1);
    expect(plan.files[0].userDecision).toBe('CLEANUP');
    expect(plan.files[0].path).toBe(mockFile.path);

    const exportFilePath = path.join(tmpDir, 'cleanup-plan.json');
    await writeCleanupPlan(plan, exportFilePath);

    expect(fs.existsSync(exportFilePath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(exportFilePath, 'utf-8'));
    expect(parsed.scanPath).toBe(tmpDir);
    expect(parsed.totalSelectedBytes).toBe(2048);

    // Invariant: original file was not deleted or modified
    expect(fs.readFileSync(mockFile.path, 'utf-8')).toBe('doc-data');
  });
});
