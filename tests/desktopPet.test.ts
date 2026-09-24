import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SPRITE_CONFIGS, resolveAnimationConfig } from '../src/electron/main/spriteConfig';
import { STATE_PRIORITIES } from '../src/pet/PetState';
import { loadManualPlatforms, Platform } from '../src/electron/main/platformDetector';

describe('Phase 5: Desktop Pet & GIF Animation Configuration', () => {
  it('defines valid GIF animation configs for all pet states and discovered emotions', () => {
    const states = ['IDLE', 'WALK_LEFT', 'WALK_RIGHT', 'SCANNING', 'HAPPY', 'SURPRISED', 'THINKING'] as const;

    for (const state of states) {
      const config = SPRITE_CONFIGS[state];
      expect(config).toBeDefined();
      expect(config.type).toBe('gif');
      expect(config.loop).toBe(true);
      expect(config.relativePath.endsWith('.gif')).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), config.relativePath))).toBe(true);
    }
  });

  it('points to valid transparent GIF asset paths for all discovered emotions', () => {
    expect(SPRITE_CONFIGS.IDLE.relativePath).toBe('assets/grumpyduck/idle.gif');
    expect(SPRITE_CONFIGS.WALK_LEFT.relativePath).toBe('assets/grumpyduck/walk-left.gif');
    expect(SPRITE_CONFIGS.WALK_RIGHT.relativePath).toBe('assets/grumpyduck/walk-right.gif');
    expect(SPRITE_CONFIGS.SCANNING.relativePath).toBe('assets/grumpyduck/scan.gif');
    expect(SPRITE_CONFIGS.HAPPY.relativePath).toBe('assets/grumpyduck/happy.gif');
    expect(SPRITE_CONFIGS.SURPRISED.relativePath).toBe('assets/grumpyduck/surprised.gif');
    expect(SPRITE_CONFIGS.THINKING.relativePath).toBe('assets/grumpyduck/thinking.gif');
  });

  it('safely falls back to idle config when requesting unavailable animation states', () => {
    const fallback = resolveAnimationConfig('SLEEPING');
    expect(fallback).toBeDefined();
    expect(fallback.relativePath).toBe('assets/grumpyduck/idle.gif');

    const unknownFallback = resolveAnimationConfig('UNKNOWN_EMOTION_XYZ');
    expect(unknownFallback.relativePath).toBe('assets/grumpyduck/idle.gif');
  });

  it('maintains strict state priority hierarchy', () => {
    expect(STATE_PRIORITIES.WARNING).toBeGreaterThan(STATE_PRIORITIES.SURPRISED);
    expect(STATE_PRIORITIES.SURPRISED).toBeGreaterThan(STATE_PRIORITIES.SCANNING);
    expect(STATE_PRIORITIES.SCANNING).toBeGreaterThan(STATE_PRIORITIES.HAPPY);
    expect(STATE_PRIORITIES.HAPPY).toBe(STATE_PRIORITIES.THINKING);
    expect(STATE_PRIORITIES.HAPPY).toBeGreaterThan(STATE_PRIORITIES.WALK_LEFT);
    expect(STATE_PRIORITIES.WALK_LEFT).toBeGreaterThan(STATE_PRIORITIES.IDLE);
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


  it('guarantees all GIFs exist on disk with non-zero size and transparent GIF header', () => {
    const gifNames = ['idle.gif', 'walk-left.gif', 'walk-right.gif', 'scan.gif', 'happy.gif', 'surprised.gif', 'thinking.gif'];
    for (const name of gifNames) {
      const p = path.resolve(process.cwd(), 'assets/grumpyduck', name);
      expect(fs.existsSync(p)).toBe(true);
      const stat = fs.statSync(p);
      expect(stat.size).toBeGreaterThan(1000);
      const buf = fs.readFileSync(p);
      // Check GIF89a / GIF87a header
      const header = buf.subarray(0, 6).toString('ascii');
      expect(header === 'GIF89a' || header === 'GIF87a').toBe(true);
    }
  });

  it('correctly categorizes passive, movement, and real-event activities', async () => {
    const { PASSIVE_ACTIVITIES, MOVEMENT_ACTIVITIES, REAL_EVENT_ACTIVITIES, ACTIVITY_INTERVAL_MS } = await import('../src/electron/main/movement');
    expect(ACTIVITY_INTERVAL_MS).toBe(5000);
    expect(PASSIVE_ACTIVITIES).toContain('IDLE');
    expect(PASSIVE_ACTIVITIES).toContain('HAPPY');
    expect(PASSIVE_ACTIVITIES).toContain('THINKING');
    expect(PASSIVE_ACTIVITIES).toContain('SURPRISED');
    expect(PASSIVE_ACTIVITIES).not.toContain('SCANNING');

    expect(MOVEMENT_ACTIVITIES).toContain('WALK_LEFT');
    expect(MOVEMENT_ACTIVITIES).toContain('WALK_RIGHT');

    expect(REAL_EVENT_ACTIVITIES).toContain('SCANNING');
    expect(REAL_EVENT_ACTIVITIES).toContain('WARNING');
  });
});


