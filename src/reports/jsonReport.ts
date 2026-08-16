import * as fs from 'fs';
import * as path from 'path';
import { ScanResult } from '../types/scanner';

// ─────────────────────────────────────────────────────────────────────────────
// JSON reporter
//
// Serialises the ScanResult to a stable JSON schema for consumption by
// the future Tauri desktop UI or any other tool.
//
// Schema stability note: The top-level shape of this output tracks the
// ScanResult interface in types/scanner.ts. The `schemaVersion` field allows
// consumers to detect breaking changes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialise a ScanResult to a formatted JSON string.
 *
 * The result includes all data needed to reconstruct any view in the future
 * Tauri desktop UI without re-scanning.
 */
export function toJSON(result: ScanResult): string {
  // We use JSON.stringify with indentation for readability when the user
  // pipes the output to a file. For machine consumption the whitespace
  // is ignored.
  return JSON.stringify(result, null, 2);
}

/**
 * Write a JSON report.
 *
 * @param result   The completed ScanResult.
 * @param outPath  Optional file path. If omitted, the JSON is written to stdout.
 */
export async function writeJSONReport(result: ScanResult, outPath?: string): Promise<void> {
  const json = toJSON(result);

  if (!outPath) {
    process.stdout.write(json + '\n');
    return;
  }

  // Ensure the output directory exists before writing.
  const dir = path.dirname(path.resolve(outPath));
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(outPath, json, 'utf-8');

  // Confirm to the user where the file was written (goes to stderr so it
  // doesn't pollute the JSON stream if they are piping stdout).
  process.stderr.write(`\n🦆  GrumpyDuck: JSON report written to ${outPath}\n\n`);
}
