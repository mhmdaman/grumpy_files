import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validateCleanupTarget } from '../src/cleanup/validator';
import { readCleanupPlan, getCleanupTargets } from '../src/cleanup/plan';

describe('Phase 4: Safe Cleanup Validation', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grumpyduck-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('rejects protected system paths', async () => {
    const result = await validateCleanupTarget({
      path: '/System/Library/CoreServices/Finder.app',
      name: 'Finder.app',
      size: 1000,
      classification: 'APPLICATION',
      recommendation: 'REVIEW',
      userDecision: 'CLEANUP',
      reasons: []
    } as any);

    expect(result).toContain('Protected system path');
  });

  it('rejects application bundles', async () => {
    const appPath = path.join(tempDir, 'MyApp.app');
    fs.mkdirSync(appPath);

    const result = await validateCleanupTarget({
      path: appPath,
      name: 'MyApp.app',
      size: 1000,
      classification: 'APPLICATION',
      recommendation: 'REVIEW',
      userDecision: 'CLEANUP',
      reasons: []
    } as any);

    expect(result).toContain('Application bundles cannot be removed');
  });

  it('rejects directories', async () => {
    const dirPath = path.join(tempDir, 'SomeDir');
    fs.mkdirSync(dirPath);

    const result = await validateCleanupTarget({
      path: dirPath,
      name: 'SomeDir',
      size: 64,
      classification: 'UNKNOWN',
      recommendation: 'REVIEW',
      userDecision: 'CLEANUP',
      reasons: []
    } as any);

    expect(result).toContain('Directories are not supported');
  });

  it('rejects files whose size has changed', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'hello world');

    const result = await validateCleanupTarget({
      path: filePath,
      name: 'test.txt',
      size: 9999, // incorrect size
      classification: 'DOCUMENT',
      recommendation: 'REVIEW',
      userDecision: 'CLEANUP',
      reasons: []
    } as any);

    expect(result).toContain('File size changed');
  });

  it('accepts valid unchanged files', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'hello world'); // 11 bytes

    const result = await validateCleanupTarget({
      path: filePath,
      name: 'test.txt',
      size: 11,
      classification: 'DOCUMENT',
      recommendation: 'REVIEW',
      userDecision: 'CLEANUP',
      reasons: []
    } as any);

    expect(result).toBeNull();
  });
});

describe('Cleanup Plan Parsing', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grumpyduck-test-plan-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses valid plan and filters targets', async () => {
    const planPath = path.join(tempDir, 'plan.json');
    const mockPlan = {
      scanPath: tempDir,
      createdAt: new Date().toISOString(),
      readOnly: true,
      summary: {},
      totalSelectedBytes: 100,
      files: [
        { name: 'f1.txt', userDecision: 'KEEP' },
        { name: 'f2.txt', userDecision: 'CLEANUP' },
        { name: 'f3.txt', userDecision: 'SKIP' },
      ]
    };
    fs.writeFileSync(planPath, JSON.stringify(mockPlan));

    const plan = await readCleanupPlan(planPath);
    expect(plan.scanPath).toBe(tempDir);

    const targets = getCleanupTargets(plan);
    expect(targets.length).toBe(1);
    expect(targets[0].name).toBe('f2.txt');
  });
});
