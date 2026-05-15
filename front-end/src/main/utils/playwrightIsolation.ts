import { app } from 'electron';

export const DEFAULT_SESSION_PARTITION = 'persist:main';

export function configurePlaywrightUserDataPath() {
  const userDataPath = getTrimmedEnv('PLAYWRIGHT_USER_DATA_DIR');

  if (isPlaywrightSession() && userDataPath) {
    app.setPath('userData', userDataPath);
  }
}

export function getSessionPartitionName(): string {
  return getTrimmedEnv('PLAYWRIGHT_SESSION_PARTITION') ?? DEFAULT_SESSION_PARTITION;
}

export function isPlaywrightSession(): boolean {
  return process.env.PLAYWRIGHT_TEST === 'true';
}

export function shouldBypassSingleInstanceLock(): boolean {
  return isPlaywrightSession() && getTrimmedEnv('PLAYWRIGHT_DISABLE_SINGLE_INSTANCE_LOCK') === 'true';
}

function getTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}
