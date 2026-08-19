import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  classifyFile,
  analyzeFile,
  analyzeFiles,
  buildIntelligenceSummary,
  confidenceToLabel,
} from '../src/intelligence';
import { collectFileMetadata } from '../src/scanner/fileMetadata';
import { scan } from '../src/scanner/scanner';
import { DEFAULT_CONFIG } from '../src/scanner/rules';
import { FileMetadata } from '../src/types/scanner';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'grumpyduck-intel-test-'));
}

function cleanupTmpDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function createMockFile(
  name: string,
  filePath: string,
  extension: string,
  size = 1000,
  options: Partial<FileMetadata> = {},
): FileMetadata {
  return {
    name,
    path: filePath,
    extension,
    size,
    createdAt: Date.now() - 10000,
    modifiedAt: Date.now() - 5000,
    accessedAt: Date.now(),
    category: 'Documents',
    isHidden: name.startsWith('.'),
    parent: path.dirname(filePath),
    sizeLabel: null,
    ageLabel: null,
    hash: null,
    ...options,
  };
}

describe('File Intelligence Engine', () => {
  // ── 1. Dataset Detection ──────────────────────────────────────────────────
  describe('Dataset Detection', () => {
    it('classifies UNSW-NB15_training-set.csv as DATASET, KEEP, High confidence', () => {
      const file = createMockFile(
        'UNSW-NB15_training-set.csv',
        '/Users/test/Downloads/UNSW-NB15_training-set.csv',
        'csv',
        120 * 1024 * 1024,
      );

      const classification = classifyFile(file);
      expect(classification.type).toBe('DATASET');
      expect(classification.confidence).toBeGreaterThanOrEqual(0.8);
      expect(confidenceToLabel(classification.confidence)).toBe('High');

      const intel = analyzeFile(file);
      expect(intel.classification.type).toBe('DATASET');
      expect(intel.recommendation.action).toBe('KEEP');
      expect(intel.confidenceLevel).toBe('High');
      expect(intel.recommendation.reasons.length).toBeGreaterThan(0);
    });

    it('distinguishes datasets from ordinary business CSV files', () => {
      const datasetFile = createMockFile(
        'customer_features_dataset.csv',
        '/Users/test/Documents/customer_features_dataset.csv',
        'csv',
      );
      const expensesFile = createMockFile(
        'expenses_2024.csv',
        '/Users/test/Documents/expenses_2024.csv',
        'csv',
      );

      const datasetIntel = analyzeFile(datasetFile);
      const expensesIntel = analyzeFile(expensesFile);

      expect(datasetIntel.classification.type).toBe('DATASET');
      expect(datasetIntel.recommendation.action).toBe('KEEP');

      expect(expensesIntel.classification.type).toBe('DOCUMENT');
    });

    it('identifies native dataset formats (.parquet, .feather, .npy) as DATASET', () => {
      const parquetFile = createMockFile('data.parquet', '/path/data.parquet', 'parquet');
      const npyFile = createMockFile('weights.npy', '/path/weights.npy', 'npy');

      expect(classifyFile(parquetFile).type).toBe('DATASET');
      expect(classifyFile(npyFile).type).toBe('DATASET');
    });
  });

  // ── 2. Installer Detection ────────────────────────────────────────────────
  describe('Installer Detection', () => {
    it('classifies googlechrome.dmg as INSTALLER, REVIEW, High confidence', () => {
      const file = createMockFile(
        'googlechrome.dmg',
        '/Users/test/Downloads/googlechrome.dmg',
        'dmg',
        205 * 1024 * 1024,
      );

      const classification = classifyFile(file);
      expect(classification.type).toBe('INSTALLER');
      expect(classification.confidence).toBeGreaterThanOrEqual(0.8);
      expect(confidenceToLabel(classification.confidence)).toBe('High');

      const intel = analyzeFile(file);
      expect(intel.classification.type).toBe('INSTALLER');
      expect(intel.recommendation.action).toBe('REVIEW');
      expect(intel.confidenceLevel).toBe('High');
      expect(intel.recommendation.reason).toContain('installer');
    });

    it('detects installer keywords across .pkg, .exe, .msi', () => {
      const pkgFile = createMockFile('node-v20-setup.pkg', '/Downloads/node-v20-setup.pkg', 'pkg');
      const exeFile = createMockFile('installer_v2.exe', '/Downloads/installer_v2.exe', 'exe');

      expect(classifyFile(pkgFile).type).toBe('INSTALLER');
      expect(classifyFile(exeFile).type).toBe('INSTALLER');
    });
  });

  // ── 3. Duplicate Awareness ────────────────────────────────────────────────
  describe('Duplicate Awareness', () => {
    it('recommends POTENTIAL_CLEANUP for duplicate extra copies', () => {
      const fileA = createMockFile('file.pdf', '/docs/file.pdf', 'pdf', 5000, { hash: 'hash123' });
      const fileB = createMockFile('file (1).pdf', '/docs/file (1).pdf', 'pdf', 5000, { hash: 'hash123' });

      // Primary copy gets REVIEW, extra copy gets POTENTIAL_CLEANUP
      const intelPrimary = analyzeFile(fileA, true, false);
      const intelExtra = analyzeFile(fileB, true, true);

      expect(intelPrimary.classification.type).toBe('DOCUMENT');
      expect(intelPrimary.isDuplicate).toBe(true);
      expect(intelPrimary.recommendation.action).toBe('REVIEW');

      expect(intelExtra.classification.type).toBe('DOCUMENT');
      expect(intelExtra.isDuplicate).toBe(true);
      expect(intelExtra.recommendation.action).toBe('POTENTIAL_CLEANUP');
      expect(intelExtra.recommendation.reason).toContain('identical copies');
    });
  });

  // ── 4. Development Artifact Detection ─────────────────────────────────────
  describe('Development Artifact Detection', () => {
    it('classifies project/node_modules/package/index.js as DEVELOPMENT_ARTIFACT, IGNORE', () => {
      const file = createMockFile(
        'index.js',
        '/Users/test/project/node_modules/package/index.js',
        'js',
        1000,
        { category: 'Code' },
      );

      const classification = classifyFile(file);
      expect(classification.type).toBe('DEVELOPMENT_ARTIFACT');
      expect(classification.confidence).toBeGreaterThanOrEqual(0.8);

      const intel = analyzeFile(file);
      expect(intel.classification.type).toBe('DEVELOPMENT_ARTIFACT');
      expect(intel.recommendation.action).toBe('IGNORE');
      expect(intel.recommendation.reason).toContain('generated/project dependency');
    });

    it('classifies generated build files (.pyc, .map, .o) as DEVELOPMENT_ARTIFACT', () => {
      const pyc = createMockFile('cache.pyc', '/src/__pycache__/cache.pyc', 'pyc');
      const map = createMockFile('bundle.js.map', '/dist/bundle.js.map', 'map');

      expect(classifyFile(pyc).type).toBe('DEVELOPMENT_ARTIFACT');
      expect(classifyFile(map).type).toBe('DEVELOPMENT_ARTIFACT');
    });
  });

  // ── 5. Old Document Handling ──────────────────────────────────────────────
  describe('Old Document Handling', () => {
    it('marks old document as REVIEW (not POTENTIAL_CLEANUP)', () => {
      const file = createMockFile('old-notes.pdf', '/docs/old-notes.pdf', 'pdf', 5000, {
        ageLabel: 'Very Old',
        modifiedAt: Date.now() - 400 * 24 * 60 * 60 * 1000,
      });

      const intel = analyzeFile(file);
      expect(intel.classification.type).toBe('DOCUMENT');
      expect(intel.recommendation.action).toBe('REVIEW');
      expect(intel.recommendation.action).not.toBe('POTENTIAL_CLEANUP');
      expect(intel.recommendation.reasons.some((r) => r.includes('long time'))).toBe(true);
    });
  });

  // ── 6. Unknown Files ──────────────────────────────────────────────────────
  describe('Unknown Files', () => {
    it('classifies something.xyz as UNKNOWN with Low confidence', () => {
      const file = createMockFile('something.xyz', '/Users/test/something.xyz', 'xyz');

      const classification = classifyFile(file);
      expect(classification.type).toBe('UNKNOWN');
      expect(classification.confidence).toBeLessThan(0.5);
      expect(confidenceToLabel(classification.confidence)).toBe('Low');

      const intel = analyzeFile(file);
      expect(intel.classification.type).toBe('UNKNOWN');
      expect(intel.confidenceLevel).toBe('Low');
      expect(intel.recommendation.action).toBe('REVIEW');
    });
  });

  // ── 7. Application Bundles ────────────────────────────────────────────────
  describe('Application Bundles', () => {
    it('classifies macOS app bundles as APPLICATION, KEEP, High confidence', () => {
      const app = createMockFile('Visual Studio Code.app', '/Applications/Visual Studio Code.app', 'app', 500000000, {
        category: 'Applications',
      });

      const classification = classifyFile(app);
      expect(classification.type).toBe('APPLICATION');
      expect(classification.confidence).toBeGreaterThanOrEqual(0.9);

      const intel = analyzeFile(app);
      expect(intel.classification.type).toBe('APPLICATION');
      expect(intel.recommendation.action).toBe('KEEP');
    });
  });

  // ── 8. Integration: analyzeFiles & buildIntelligenceSummary ───────────────
  describe('Integration with Scan Result', () => {
    let tmpDir: string;
    beforeEach(() => { tmpDir = makeTmpDir(); });
    afterEach(() => { cleanupTmpDir(tmpDir); });

    it('enriches all files during full scan and populates intelligence summary', async () => {
      // Create various test files
      fs.writeFileSync(path.join(tmpDir, 'googlechrome.dmg'), 'dmg-content');
      fs.writeFileSync(path.join(tmpDir, 'UNSW-NB15_training-set.csv'), 'csv-data');
      fs.writeFileSync(path.join(tmpDir, 'doc1.pdf'), 'identical-pdf');
      fs.writeFileSync(path.join(tmpDir, 'doc2.pdf'), 'identical-pdf');

      const result = await scan(tmpDir, DEFAULT_CONFIG);

      expect(result.summary.intelligenceSummary).toBeDefined();
      const intelSummary = result.summary.intelligenceSummary!;

      expect(intelSummary.datasetCount).toBe(1);
      expect(intelSummary.installerCount).toBe(1);
      expect(intelSummary.duplicateGroupCount).toBe(1);

      // Verify each file has intelligence attached
      for (const file of result.files) {
        expect(file.intelligence).toBeDefined();
        expect(file.intelligence?.classification.type).toBeDefined();
        expect(file.intelligence?.recommendation.action).toBeDefined();
        expect(file.intelligence?.confidenceLevel).toBeDefined();
      }

      // Check smartCleanupBytes is calculated only from POTENTIAL_CLEANUP
      expect(result.summary.smartCleanupBytes).toBe(Buffer.byteLength('identical-pdf'));
    });
  });
});
