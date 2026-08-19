// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Safety & Protected Path Layer
//
// Defines critical system and protected locations that should never be
// targeted for cleanup or modification.
// ─────────────────────────────────────────────────────────────────────────────

import * as path from 'path';
import * as os from 'os';

/** Critical system root directories on macOS and Unix systems. */
export const PROTECTED_SYSTEM_PREFIXES = [
  '/System',
  '/Library',
  '/usr',
  '/bin',
  '/sbin',
  '/etc',
  '/dev',
  '/opt',
  '/boot',
  '/var',
  '/private',
];

/** Temporary or scratch prefixes that are explicitly allowed (even within /var or /private). */
export const ALLOWED_TEMP_PREFIXES = [
  '/tmp',
  '/private/tmp',
  '/var/folders',
  '/private/var/folders',
  '/var/tmp',
  '/private/var/tmp',
];

/**
 * Returns true if the given absolute path is located in a protected system directory.
 *
 * @param targetPath Absolute or relative filesystem path.
 */
export function isProtectedPath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const normalized = resolved.replace(/\\/g, '/');

  // Root directory itself
  if (normalized === '/' || normalized === '') {
    return true;
  }

  // Explicitly allowed temporary / test directory prefixes (e.g. /var/folders/...)
  for (const tempPrefix of ALLOWED_TEMP_PREFIXES) {
    if (normalized === tempPrefix || normalized.startsWith(tempPrefix + '/')) {
      return false;
    }
  }

  // System prefix checks
  for (const prefix of PROTECTED_SYSTEM_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(prefix + '/')) {
      return true;
    }
  }

  // User Library Keychains / sensitive preferences
  const homedir = os.homedir().replace(/\\/g, '/');
  if (homedir && homedir !== '/') {
    const keychains = path.posix.join(homedir, 'Library/Keychains');
    if (normalized === keychains || normalized.startsWith(keychains + '/')) {
      return true;
    }
  }

  return false;
}

/**
 * Returns a human-readable reason why a path is protected, or null if it is not protected.
 */
export function getProtectionReason(targetPath: string): string | null {
  const resolved = path.resolve(targetPath);
  const normalized = resolved.replace(/\\/g, '/');

  if (normalized === '/' || normalized === '') {
    return 'Filesystem root directory is protected.';
  }

  for (const tempPrefix of ALLOWED_TEMP_PREFIXES) {
    if (normalized === tempPrefix || normalized.startsWith(tempPrefix + '/')) {
      return null;
    }
  }

  for (const prefix of PROTECTED_SYSTEM_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(prefix + '/')) {
      return `Located in critical system directory '${prefix}'.`;
    }
  }

  const homedir = os.homedir().replace(/\\/g, '/');
  if (homedir && homedir !== '/') {
    const keychains = path.posix.join(homedir, 'Library/Keychains');
    if (normalized === keychains || normalized.startsWith(keychains + '/')) {
      return 'Located in user Keychain / security directory.';
    }
  }

  return null;
}
