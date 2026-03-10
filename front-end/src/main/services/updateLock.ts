import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const LOCK_FILE_NAME = 'update.lock';

export interface UpdateLock {
  version: string;
  timestamp: number;
}

function getLockFilePath(): string {
  return path.join(app.getPath('userData'), LOCK_FILE_NAME);
}

export function createUpdateLock(targetVersion: string): void {
  const lock: UpdateLock = {
    version: targetVersion,
    timestamp: Date.now(),
  };
  fs.writeFileSync(getLockFilePath(), JSON.stringify(lock), 'utf-8');
}

export function removeUpdateLock(): void {
  try {
    fs.unlinkSync(getLockFilePath());
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export function getUpdateLock(): UpdateLock | null {
  const lockPath = getLockFilePath();
  if (!fs.existsSync(lockPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(lockPath, 'utf-8');
    const data = JSON.parse(content);
    if (typeof data?.version !== 'string' || typeof data?.timestamp !== 'number') {
      return null;
    }
    return data as UpdateLock;
  } catch {
    return null;
  }
}

export function isUpdateLockStale(
  lock?: UpdateLock | null,
  maxAgeMs: number = 10 * 60 * 1000,
): boolean {
  const resolved = lock ?? getUpdateLock();
  if (!resolved) {
    return false;
  }
  return Date.now() - resolved.timestamp > maxAgeMs;
}
