import * as fs from 'fs';
import * as path from 'path';
import { CleanupPlanExport, ExportedPlanItem } from '../types/review';

/**
 * Validates and reads a cleanup plan from a JSON file.
 *
 * @param planPath Absolute or relative path to the plan file.
 * @returns The parsed CleanupPlanExport.
 */
export async function readCleanupPlan(planPath: string): Promise<CleanupPlanExport> {
  const resolvedPath = path.resolve(planPath);

  try {
    const data = await fs.promises.readFile(resolvedPath, 'utf8');
    const plan = JSON.parse(data) as CleanupPlanExport;

    if (!plan || !plan.scanPath || !Array.isArray(plan.files)) {
      throw new Error('Invalid plan format: missing required fields.');
    }

    return plan;
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      throw new Error(`Plan file not found: ${planPath}`);
    }
    throw new Error(`Failed to parse plan file: ${error.message}`);
  }
}

/**
 * Gets only the files from the plan that were explicitly marked for CLEANUP.
 */
export function getCleanupTargets(plan: CleanupPlanExport): ExportedPlanItem[] {
  return plan.files.filter(f => f.userDecision === 'CLEANUP');
}
