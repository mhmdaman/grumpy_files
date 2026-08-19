import { describe, it, expect } from 'vitest';
import { isProtectedPath, getProtectionReason } from '../src/safety/protectedPaths';

describe('Safety & Protected Paths Layer', () => {
  it('protects root directory', () => {
    expect(isProtectedPath('/')).toBe(true);
    expect(getProtectionReason('/')).toContain('root');
  });

  it('protects critical macOS and Unix system directories', () => {
    const systemPaths = [
      '/System',
      '/System/Library/CoreServices',
      '/Library',
      '/Library/Preferences',
      '/usr',
      '/usr/bin',
      '/usr/local/bin',
      '/bin',
      '/bin/sh',
      '/sbin',
      '/var',
      '/var/log',
      '/private',
      '/private/etc',
      '/etc',
      '/dev',
    ];

    for (const p of systemPaths) {
      expect(isProtectedPath(p)).toBe(true);
      expect(getProtectionReason(p)).not.toBeNull();
    }
  });

  it('does NOT flag normal user directories as protected system paths', () => {
    const userPaths = [
      '/Users/muhammedaman/Downloads/file.pdf',
      '/Users/muhammedaman/Desktop/project',
      '/Users/muhammedaman/Documents/notes.txt',
      '/tmp/test-folder/sample.dmg',
    ];

    for (const p of userPaths) {
      expect(isProtectedPath(p)).toBe(false);
      expect(getProtectionReason(p)).toBeNull();
    }
  });
});
