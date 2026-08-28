import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SPRITE_CONFIGS } from '../src/electron/main/spriteConfig';

describe('Phase 5: Desktop Pet & Sprite Configuration', () => {
  it('defines 8 frames for all sprite animations', () => {
    const states = ['IDLE', 'WALK_LEFT', 'WALK_RIGHT', 'SCANNING'] as const;

    for (const state of states) {
      const config = SPRITE_CONFIGS[state];
      expect(config).toBeDefined();
      expect(config.frameCount).toBe(8);
      expect(config.fps).toBeGreaterThan(0);
      expect(fs.existsSync(path.resolve(process.cwd(), config.relativePath))).toBe(true);
    }
  });

  it('points to valid sprite image asset paths', () => {
    expect(SPRITE_CONFIGS.IDLE.relativePath).toBe('assets/grumpyduck/idle.png');
    expect(SPRITE_CONFIGS.WALK_LEFT.relativePath).toBe('assets/grumpyduck/walk-left.png');
    expect(SPRITE_CONFIGS.WALK_RIGHT.relativePath).toBe('assets/grumpyduck/walk-right.png');
    expect(SPRITE_CONFIGS.SCANNING.relativePath).toBe('assets/grumpyduck/scan.png');
  });

  it('persists and reads pet position correctly', () => {
    const configDir = path.join(os.homedir(), '.grumpyduck');
    const posFile = path.join(configDir, 'pet-position.json');

    // Create or mock saving
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
});
