// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — File Intelligence Classifier
// ─────────────────────────────────────────────────────────────────────────────

import { FileMetadata } from '../types/scanner';
import { FileClassification, IntelligenceCategory } from '../types/intelligence';
import {
  DATASET_FILENAME_PATTERNS,
  INSTALLER_FILENAME_PATTERNS,
  INSTALLER_EXTENSIONS,
  DATA_EXTENSIONS,
  DEV_ARTIFACT_EXTENSIONS,
  EXTENSION_TO_CATEGORY,
} from './rules';
import { isInDevDirectory, isTemporaryFile } from './context';
import { clampScore } from './confidence';

/**
 * Checks if a filename matches dataset naming patterns.
 */
export function hasDatasetNamePattern(filename: string): boolean {
  const lower = filename.toLowerCase();
  return DATASET_FILENAME_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Checks if a filename matches installer naming patterns.
 */
export function hasInstallerNamePattern(filename: string): boolean {
  const lower = filename.toLowerCase();
  return INSTALLER_FILENAME_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Classifies a file using name, extension, directory context, and bundle status.
 *
 * @param file FileMetadata collected from scanner.
 * @returns FileClassification with category and confidence (0.0 to 1.0).
 */
export function classifyFile(file: FileMetadata): FileClassification {
  const name = file.name;
  const lowerName = name.toLowerCase();
  const ext = file.extension.toLowerCase();
  const filePath = file.path;

  // 1. Application bundles (.app, .bundle, etc.)
  if (file.category === 'Applications' || ext === 'app' || ext === 'bundle') {
    return {
      type: 'APPLICATION',
      confidence: 0.99,
    };
  }

  // 2. Development directories and artifacts (e.g. node_modules, build outputs, *.pyc, *.map)
  if (isInDevDirectory(filePath)) {
    return {
      type: 'DEVELOPMENT_ARTIFACT',
      confidence: 0.98,
    };
  }

  if (DEV_ARTIFACT_EXTENSIONS.has(ext)) {
    return {
      type: 'DEVELOPMENT_ARTIFACT',
      confidence: 0.95,
    };
  }

  // 3. Temporary / scratch files
  if (isTemporaryFile(name, ext)) {
    return {
      type: 'TEMPORARY_FILE',
      confidence: 0.95,
    };
  }

  // 4. Dataset detection (pattern-matching filename + data extension)
  const isDatasetNamed = hasDatasetNamePattern(lowerName);
  if (isDatasetNamed) {
    return {
      type: 'DATASET',
      confidence: 0.95,
    };
  }

  if (DATA_EXTENSIONS.has(ext) && ext !== 'csv' && ext !== 'tsv') {
    // Parquet, Feather, HDF5, etc. are natively datasets
    return {
      type: 'DATASET',
      confidence: 0.90,
    };
  }

  // 5. Installers
  if (INSTALLER_EXTENSIONS.has(ext)) {
    const hasNameMatch = hasInstallerNamePattern(lowerName);
    return {
      type: 'INSTALLER',
      confidence: hasNameMatch ? 0.98 : 0.95,
    };
  }

  if (hasInstallerNamePattern(lowerName) && (ext === 'zip' || ext === 'tar' || ext === 'gz' || ext === 'rar')) {
    return {
      type: 'INSTALLER',
      confidence: 0.85,
    };
  }

  // 6. Direct extension mappings for standard types
  const mappedCategory = EXTENSION_TO_CATEGORY[ext];
  if (mappedCategory) {
    return {
      type: mappedCategory,
      confidence: 0.90,
    };
  }

  // 7. Unknown or extensionless files
  return {
    type: 'UNKNOWN',
    confidence: clampScore(ext ? 0.25 : 0.20),
  };
}
