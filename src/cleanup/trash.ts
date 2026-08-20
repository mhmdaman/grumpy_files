import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { isProtectedPath } from '../safety/protectedPaths';

const execFileAsync = promisify(execFile);

/**
 * Safely moves a file to the macOS Trash using native AppleScript.
 *
 * This function enforces strict read-only / safe deletion behavior:
 * - Uses native Trash mechanism (files are fully recoverable).
 * - Explicitly rejects fs.unlink or fs.rm usage.
 * - Enforces the protected paths safety layer.
 *
 * @param filePath The absolute path of the file to move to Trash.
 */
export async function moveToTrash(filePath: string): Promise<void> {
  const resolved = path.resolve(filePath);
  if (isProtectedPath(resolved)) {
    throw new Error(`Safety violation: Cannot move protected path to Trash: ${resolved}`);
  }

  // Double check the file exists before trashing it
  try {
    await fs.promises.stat(resolved);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      throw new Error(`File does not exist: ${resolved}`);
    }
    throw error;
  }

  // Use AppleScript to safely move to macOS Trash
  // Equivalent to user pressing Cmd+Backspace in Finder
  const script = `tell application "Finder" to delete POSIX file "${resolved}"`;
  
  try {
    await execFileAsync('osascript', ['-e', script]);
  } catch (err: unknown) {
    throw new Error(`Failed to move file to Trash: ${(err as Error).message}`);
  }
}

