import { readBooleanEnv } from './booleanEnv.js';

export const SHARED_ENVIRONMENT_ENV = 'PLAYWRIGHT_SHARED_ENV';
export const PRESERVE_BACKEND_STATE_ENV = 'PLAYWRIGHT_PRESERVE_BACKEND_STATE';

export function isSharedEnvironmentRun(): boolean {
  return process.env[SHARED_ENVIRONMENT_ENV] === 'true';
}

export function shouldPreserveBackendState(): boolean {
  const override = readBooleanEnv(PRESERVE_BACKEND_STATE_ENV);
  return isSharedEnvironmentRun() || override === true;
}
