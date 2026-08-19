// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Recommendation Engine
// ─────────────────────────────────────────────────────────────────────────────

import { FileMetadata } from '../types/scanner';
import {
  FileClassification,
  FileRecommendation,
  Observation,
  Recommendation,
} from '../types/intelligence';
import { isInDownloads } from './context';
import { BACKUP_FILENAME_PATTERNS } from './rules';
import { formatBytes } from '../utils/formatBytes';

/**
 * Derives independent observations for a file.
 */
export function deriveObservations(
  file: FileMetadata,
  classification: FileClassification,
  isDuplicate: boolean,
): Observation[] {
  const obs: Observation[] = [];
  const lowerName = file.name.toLowerCase();

  if (file.sizeLabel !== null) {
    obs.push('LARGE');
  }

  if (file.ageLabel !== null) {
    obs.push('OLD');
  }

  if (isDuplicate) {
    obs.push('DUPLICATE');
  }

  if (classification.type === 'INSTALLER') {
    obs.push('INSTALLER');
  }

  if (classification.type === 'DATASET') {
    obs.push('DATASET');
  }

  if (classification.type === 'DEVELOPMENT_ARTIFACT') {
    obs.push('DEV_ARTIFACT');
  }

  if (classification.type === 'TEMPORARY_FILE') {
    obs.push('TEMPORARY');
  }

  if (isInDownloads(file.path)) {
    obs.push('DOWNLOADS_LOCATION');
  }

  if (BACKUP_FILENAME_PATTERNS.some((pat) => lowerName.includes(pat))) {
    obs.push('BACKUP');
  }

  return obs;
}

/**
 * Produces a conservative recommendation and human-readable explanations
 * based on file metadata, classification, observations, and duplicate status.
 *
 * @param file FileMetadata collected during scan.
 * @param classification Classification from classifier.
 * @param isDuplicate Whether this file is part of a duplicate group with identical hash.
 * @param isExtraDuplicate Whether this file is an extra copy (not the primary kept copy).
 */
export function generateRecommendation(
  file: FileMetadata,
  classification: FileClassification,
  isDuplicate: boolean,
  isExtraDuplicate = false,
): FileRecommendation {
  const reasons: string[] = [];
  const inDownloads = isInDownloads(file.path);
  const sizeStr = formatBytes(file.size);

  // ── Rule E: Development Artifacts ──────────────────────────────────────────
  if (classification.type === 'DEVELOPMENT_ARTIFACT') {
    reasons.push('Located in a development or build/dependency directory');
    reasons.push('Generated or managed by developer tooling');
    return {
      action: 'IGNORE',
      reason: 'This appears to be generated/project dependency data.',
      reasons,
    };
  }

  // ── Applications ───────────────────────────────────────────────────────────
  if (classification.type === 'APPLICATION') {
    reasons.push('Application bundle');
    if (file.sizeLabel) reasons.push(`${sizeStr} total bundle size`);
    return {
      action: 'KEEP',
      reason: 'Application bundle detected.',
      reasons,
    };
  }

  // ── Rule D: Duplicate (identical hash) ─────────────────────────────────────
  if (isDuplicate) {
    reasons.push('Identical content hash matches other files');
    if (isExtraDuplicate) {
      reasons.push('Redundant duplicate copy');
      return {
        action: 'POTENTIAL_CLEANUP',
        reason: 'This file has identical copies elsewhere.',
        reasons,
      };
    } else {
      reasons.push('Primary copy of duplicate group');
      return {
        action: 'REVIEW',
        reason: 'Part of a duplicate group with identical copies.',
        reasons,
      };
    }
  }

  // ── Rule A: Dataset (important data/ML files) ──────────────────────────────
  if (classification.type === 'DATASET') {
    if (file.extension) reasons.push(`${file.extension.toUpperCase()} file`);
    reasons.push('Filename or format indicates dataset or training material');
    if (file.ageLabel) reasons.push('Old age alone is not sufficient reason to remove it');
    return {
      action: 'KEEP',
      reason: 'The filename strongly suggests this is a dataset.',
      reasons,
    };
  }

  // ── Rule B: Installer ──────────────────────────────────────────────────────
  if (classification.type === 'INSTALLER') {
    if (file.extension) reasons.push(`${file.extension.toUpperCase()} installer`);
    if (inDownloads) reasons.push('Located in Downloads');
    if (file.size > 0) reasons.push(sizeStr);
    reasons.push('May no longer be required if the application is already installed');
    return {
      action: 'REVIEW',
      reason: inDownloads
        ? 'This appears to be an application installer stored in Downloads.'
        : 'Application installer; review if still required.',
      reasons,
    };
  }

  // ── Temporary files ────────────────────────────────────────────────────────
  if (classification.type === 'TEMPORARY_FILE') {
    reasons.push('Temporary or system scratch file');
    if (file.size > 0) reasons.push(sizeStr);
    return {
      action: 'REVIEW',
      reason: 'Temporary file detected.',
      reasons,
    };
  }

  // ── Rule C: Normal Documents / Media / Code ────────────────────────────────
  if (file.ageLabel !== null) {
    reasons.push(file.extension ? `${file.extension.toUpperCase()} file` : 'File without extension');
    reasons.push(`Unmodified for a long time (${file.ageLabel})`);
    reasons.push('Review to confirm whether content is still needed');
    return {
      action: 'REVIEW',
      reason: 'File has not been modified in a long time; review before archiving or removing.',
      reasons,
    };
  }

  if (file.sizeLabel !== null) {
    reasons.push(file.extension ? `${file.extension.toUpperCase()} file` : 'Large file');
    reasons.push(`Size: ${sizeStr} (${file.sizeLabel})`);
    return {
      action: 'REVIEW',
      reason: `Large file (${sizeStr}); review storage impact.`,
      reasons,
    };
  }

  if (classification.type === 'UNKNOWN') {
    reasons.push('Unrecognized file extension or structure');
    return {
      action: 'REVIEW',
      reason: 'Unknown file type; review manually.',
      reasons,
    };
  }

  // Default for active normal files
  reasons.push(file.extension ? `${file.extension.toUpperCase()} file` : 'Normal user file');
  return {
    action: 'KEEP',
    reason: 'Active user file in good standing.',
    reasons,
  };
}
