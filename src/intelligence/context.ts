// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Path & Directory Context Evaluation
// ─────────────────────────────────────────────────────────────────────────────

import { DEV_DIRECTORY_NAMES, DEV_ARTIFACT_EXTENSIONS, TEMPORARY_EXTENSIONS } from './rules';

/**
 * Normalizes a file path to use forward slashes and extracts lowercase path segments.
 */
export function getPathSegments(filePath: string): string[] {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.split('/').map((s) => s.toLowerCase()).filter(Boolean);
}

/**
 * Returns true if the path is inside a Downloads folder.
 */
export function isInDownloads(filePath: string): boolean {
  const segments = getPathSegments(filePath);
  return segments.includes('downloads');
}

/**
 * Returns true if the path is inside a development, build, or package directory
 * (e.g. node_modules, dist, build, .venv, etc.).
 */
export function isInDevDirectory(filePath: string): boolean {
  const segments = getPathSegments(filePath);
  for (const seg of segments) {
    if (DEV_DIRECTORY_NAMES.has(seg)) return true;
    if (seg.startsWith('publish') || seg.startsWith('build')) return true;
  }
  return false;
}

/**
 * Returns true if the file extension or path indicates a development artifact or binary.
 */
export function isDevArtifact(extension: string, filePath: string): boolean {
  const ext = extension.toLowerCase();
  if (DEV_ARTIFACT_EXTENSIONS.has(ext)) return true;
  if (isInDevDirectory(filePath)) return true;
  return false;
}

/**
 * Returns true if the file extension or name indicates a temporary file.
 */
export function isTemporaryFile(name: string, extension: string): boolean {
  const lowerName = name.toLowerCase();
  const ext = extension.toLowerCase();

  if (TEMPORARY_EXTENSIONS.has(ext)) return true;
  if (lowerName === '.ds_store' || lowerName === 'thumbs.db' || lowerName.endsWith('~')) {
    return true;
  }
  if (lowerName.startsWith('~$') || lowerName.startsWith('.~')) {
    return true;
  }
  return false;
}
