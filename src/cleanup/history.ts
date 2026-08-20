import * as fs from 'fs';
import * as path from 'path';

export interface CleanupHistoryEntry {
  timestamp: string;
  scanPath: string;
  totalSize: number;
  files: Array<{
    path: string;
    size: number;
    action: 'MOVED_TO_TRASH';
    status: 'SUCCESS' | 'FAILED';
    error?: string;
  }>;
}

const HISTORY_FILE_PATH = path.join(process.cwd(), 'logs', 'cleanup-history.json');

/**
 * Appends a new entry to the cleanup history log.
 */
export async function writeHistoryEntry(entry: CleanupHistoryEntry): Promise<void> {
  const logsDir = path.dirname(HISTORY_FILE_PATH);
  
  // Ensure the logs directory exists
  try {
    await fs.promises.mkdir(logsDir, { recursive: true });
  } catch (e) {
    // Ignore error if it exists
  }

  let history: CleanupHistoryEntry[] = [];
  try {
    const data = await fs.promises.readFile(HISTORY_FILE_PATH, 'utf8');
    history = JSON.parse(data);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code !== 'ENOENT') {
      console.warn(`Warning: Could not read history file: ${error.message}`);
    }
  }

  history.push(entry);

  try {
    await fs.promises.writeFile(HISTORY_FILE_PATH, JSON.stringify(history, null, 2), 'utf8');
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    console.warn(`Warning: Could not save cleanup history: ${error.message}`);
  }
}

/**
 * Reads the cleanup history log.
 */
export async function getHistory(): Promise<CleanupHistoryEntry[]> {
  try {
    const data = await fs.promises.readFile(HISTORY_FILE_PATH, 'utf8');
    return JSON.parse(data) as CleanupHistoryEntry[];
  } catch (err: unknown) {
    return []; // Return empty history if file doesn't exist
  }
}
