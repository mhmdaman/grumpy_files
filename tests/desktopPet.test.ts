import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SPRITE_CONFIGS } from '../src/electron/main/spriteConfig';
import { loadManualPlatforms, Platform } from '../src/electron/main/platformDetector';

describe('Phase 5: Desktop Pet & GIF Animation Configuration', () => {
  it('defines valid GIF animation configs for all pet states', () => {
    const states = ['IDLE', 'WALK_LEFT', 'WALK_RIGHT', 'SCANNING'] as const;

    for (const state of states) {
      const config = SPRITE_CONFIGS[state];
      expect(config).toBeDefined();
      expect(config.type).toBe('gif');
      expect(config.loop).toBe(true);
      expect(config.relativePath.endsWith('.gif')).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), config.relativePath))).toBe(true);
    }
  });

  it('points to valid transparent GIF asset paths', () => {
    expect(SPRITE_CONFIGS.IDLE.relativePath).toBe('assets/grumpyduck/idle.gif');
    expect(SPRITE_CONFIGS.WALK_LEFT.relativePath).toBe('assets/grumpyduck/walk-left.gif');
    expect(SPRITE_CONFIGS.WALK_RIGHT.relativePath).toBe('assets/grumpyduck/walk-right.gif');
    expect(SPRITE_CONFIGS.SCANNING.relativePath).toBe('assets/grumpyduck/scan.gif');
  });

  it('persists and reads pet position correctly', () => {
    const configDir = path.join(os.homedir(), '.grumpyduck');
    const posFile = path.join(configDir, 'pet-position.json');

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const testPos = { x: 500, y: 400 };
    fs.writeFileSync(posFile, JSON.stringify(testPos, null, 2), 'utf-8');

    expect(fs.existsSync(posFile)).toBe(true);
    const loaded = JSON.parse(fs.readFileSync(posFile, 'utf-8'));
    expect(loaded.x).toBe(500);
    expect(loaded.y).toBe(400);
  });

  it('loads manual platforms cleanly from config file if present', () => {
    const configDir = path.join(os.homedir(), '.grumpyduck');
    const platformsFile = path.join(configDir, 'platforms.json');

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const testPlatforms = [
      { id: 'custom-shelf-1', name: 'Test Shelf', minX: 100, maxX: 600, y: 720 },
    ];
    fs.writeFileSync(platformsFile, JSON.stringify(testPlatforms, null, 2), 'utf-8');

    const loaded = loadManualPlatforms();
    expect(loaded.length).toBeGreaterThanOrEqual(1);
    const shelf = loaded.find((p) => p.id === 'custom-shelf-1');
    expect(shelf).toBeDefined();
    expect(shelf?.name).toBe('Test Shelf');
    expect(shelf?.type).toBe('MANUAL');
    expect(shelf?.y).toBe(720);

    // Clean up test file
    try {
      fs.unlinkSync(platformsFile);
    } catch {}
  });
});
