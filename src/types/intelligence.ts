// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — File Intelligence Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * High-level intelligence classification for a file.
 * Extensible and modular context-aware category.
 */
export type IntelligenceCategory =
  | 'DOCUMENT'
  | 'DATASET'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'ARCHIVE'
  | 'INSTALLER'
  | 'APPLICATION'
  | 'CODE'
  | 'DEVELOPMENT_ARTIFACT'
  | 'TEMPORARY_FILE'
  | 'UNKNOWN';

/**
 * Conservative recommendation levels for file organisation.
 * Note: 'SAFE_TO_DELETE' is explicitly omitted in Phase 1.2.
 */
export type Recommendation =
  | 'KEEP'
  | 'REVIEW'
  | 'POTENTIAL_CLEANUP'
  | 'IGNORE';

/**
 * Human-readable confidence tier derived from numeric confidence (0.0 - 1.0).
 */
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

/**
 * Independent observations collected during analysis.
 */
export type Observation =
  | 'LARGE'
  | 'OLD'
  | 'DUPLICATE'
  | 'INSTALLER'
  | 'DATASET'
  | 'DEV_ARTIFACT'
  | 'EMPTY'
  | 'TEMPORARY'
  | 'BACKUP'
  | 'DOWNLOADS_LOCATION';

/**
 * Classification details including category and confidence score.
 */
export interface FileClassification {
  type: IntelligenceCategory;
  confidence: number; // 0.0 -> 1.0
}

/**
 * Recommendation details including suggested action and human-readable explanations.
 */
export interface FileRecommendation {
  action: Recommendation;
  reason: string;
  reasons: string[];
}

/**
 * Full intelligence metadata attached to a logical file or bundle.
 */
export interface FileIntelligence {
  classification: FileClassification;
  confidenceLevel: ConfidenceLevel;
  recommendation: FileRecommendation;
  observations: Observation[];
  isDuplicate: boolean;
}

/**
 * Aggregated category intelligence statistics for summary reporting.
 */
export interface IntelligenceCategoryStats {
  category: IntelligenceCategory;
  count: number;
  totalBytes: number;
  defaultRecommendation: Recommendation;
}

/**
 * High-level intelligence summary across all files.
 */
export interface IntelligenceSummary {
  categories: Record<IntelligenceCategory, number>;
  recommendations: Record<Recommendation, number>;
  datasetCount: number;
  installerCount: number;
  devArtifactCount: number;
  duplicateGroupCount: number;
  oldFilesByIntelligence: {
    useful: { count: number; documents: number; datasets: number; archives: number };
    review: { count: number; installers: number; duplicates: number; others: number };
    development: { count: number };
    ignored: { count: number };
  };
}
