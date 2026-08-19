// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — File Intelligence Engine (Main Module)
// ─────────────────────────────────────────────────────────────────────────────

import { FileMetadata, DuplicateGroup } from '../types/scanner';
import {
  FileIntelligence,
  IntelligenceCategory,
  IntelligenceSummary,
  Recommendation,
} from '../types/intelligence';
import { classifyFile } from './classifier';
import { deriveObservations, generateRecommendation } from './recommendation';
import { confidenceToLabel } from './confidence';

export * from './classifier';
export * from './confidence';
export * from './context';
export * from './recommendation';
export * from './rules';

/**
 * Analyzes a single file metadata item and produces full intelligence info.
 */
export function analyzeFile(
  file: FileMetadata,
  isDuplicate = false,
  isExtraDuplicate = false,
): FileIntelligence {
  const classification = classifyFile(file);
  const confidenceLevel = confidenceToLabel(classification.confidence);
  const observations = deriveObservations(file, classification, isDuplicate);
  const recommendation = generateRecommendation(
    file,
    classification,
    isDuplicate,
    isExtraDuplicate,
  );

  return {
    classification,
    confidenceLevel,
    recommendation,
    observations,
    isDuplicate,
  };
}

/**
 * Enriches all scanned files in-place with context-aware intelligence,
 * confidence scores, and recommendations.
 */
export function analyzeFiles(
  files: FileMetadata[],
  duplicateGroups: DuplicateGroup[],
): void {
  // Build lookup sets for duplicate files
  const duplicateFileMap = new Map<string, { isDuplicate: boolean; isExtra: boolean }>();

  for (const group of duplicateGroups) {
    if (group.files.length >= 2) {
      const [primary, ...extras] = group.files;
      duplicateFileMap.set(primary.path, { isDuplicate: true, isExtra: false });
      for (const extra of extras) {
        duplicateFileMap.set(extra.path, { isDuplicate: true, isExtra: true });
      }
    }
  }

  for (const file of files) {
    const dupInfo = duplicateFileMap.get(file.path);
    const isDuplicate = dupInfo?.isDuplicate ?? false;
    const isExtra = dupInfo?.isExtra ?? false;

    file.intelligence = analyzeFile(file, isDuplicate, isExtra);
  }
}

/**
 * Aggregates intelligence summary statistics across all files.
 */
export function buildIntelligenceSummary(
  files: FileMetadata[],
  duplicateGroups: DuplicateGroup[],
): IntelligenceSummary {
  const categories: Record<IntelligenceCategory, number> = {
    DOCUMENT: 0,
    DATASET: 0,
    IMAGE: 0,
    VIDEO: 0,
    AUDIO: 0,
    ARCHIVE: 0,
    INSTALLER: 0,
    APPLICATION: 0,
    CODE: 0,
    DEVELOPMENT_ARTIFACT: 0,
    TEMPORARY_FILE: 0,
    UNKNOWN: 0,
  };

  const recommendations: Record<Recommendation, number> = {
    KEEP: 0,
    REVIEW: 0,
    POTENTIAL_CLEANUP: 0,
    IGNORE: 0,
  };

  const oldFilesByIntelligence = {
    useful: { count: 0, documents: 0, datasets: 0, archives: 0 },
    review: { count: 0, installers: 0, duplicates: 0, others: 0 },
    development: { count: 0 },
    ignored: { count: 0 },
  };

  let datasetCount = 0;
  let installerCount = 0;
  let devArtifactCount = 0;

  for (const file of files) {
    const intel = file.intelligence ?? analyzeFile(file);

    categories[intel.classification.type] = (categories[intel.classification.type] ?? 0) + 1;
    recommendations[intel.recommendation.action] = (recommendations[intel.recommendation.action] ?? 0) + 1;

    if (intel.classification.type === 'DATASET') datasetCount++;
    if (intel.classification.type === 'INSTALLER') installerCount++;
    if (intel.classification.type === 'DEVELOPMENT_ARTIFACT') devArtifactCount++;

    // Categorize old files specifically
    if (file.ageLabel !== null) {
      if (intel.classification.type === 'DEVELOPMENT_ARTIFACT') {
        oldFilesByIntelligence.development.count++;
      } else if (intel.recommendation.action === 'IGNORE') {
        oldFilesByIntelligence.ignored.count++;
      } else if (intel.classification.type === 'DATASET') {
        oldFilesByIntelligence.useful.count++;
        oldFilesByIntelligence.useful.datasets++;
      } else if (intel.classification.type === 'ARCHIVE') {
        oldFilesByIntelligence.useful.count++;
        oldFilesByIntelligence.useful.archives++;
      } else if (intel.classification.type === 'DOCUMENT' && intel.recommendation.action === 'KEEP') {
        oldFilesByIntelligence.useful.count++;
        oldFilesByIntelligence.useful.documents++;
      } else if (intel.classification.type === 'INSTALLER') {
        oldFilesByIntelligence.review.count++;
        oldFilesByIntelligence.review.installers++;
      } else if (intel.isDuplicate) {
        oldFilesByIntelligence.review.count++;
        oldFilesByIntelligence.review.duplicates++;
      } else {
        oldFilesByIntelligence.review.count++;
        if (intel.classification.type === 'DOCUMENT') {
          oldFilesByIntelligence.useful.count++;
          oldFilesByIntelligence.useful.documents++;
        } else {
          oldFilesByIntelligence.review.others++;
        }
      }
    }
  }

  return {
    categories,
    recommendations,
    datasetCount,
    installerCount,
    devArtifactCount,
    duplicateGroupCount: duplicateGroups.length,
    oldFilesByIntelligence,
  };
}
