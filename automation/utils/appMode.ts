import {
  ELECTRON_APP_MODES,
  type TransactionToolAppMode,
} from '../constants/index.js';
import { readBooleanEnv } from './booleanEnv.js';

export const ELECTRON_APP_MODE_ENV = 'ELECTRON_APP_MODE';
export const PRESERVE_LOCAL_APP_STATE_ENV = 'ELECTRON_PRESERVE_APP_STATE';
export type { TransactionToolAppMode } from '../constants/appMode.constants.js';

const DEFAULT_ELECTRON_APP_MODE: TransactionToolAppMode = ELECTRON_APP_MODES.LAUNCH;

export function getElectronAppMode(): TransactionToolAppMode {
  const mode = process.env[ELECTRON_APP_MODE_ENV]?.trim() || DEFAULT_ELECTRON_APP_MODE;

  switch (mode) {
    case ELECTRON_APP_MODES.LAUNCH:
    case ELECTRON_APP_MODES.ATTACH:
      return mode;
    default:
      throw new Error(
        `Invalid ${ELECTRON_APP_MODE_ENV} "${mode}". Expected "${ELECTRON_APP_MODES.LAUNCH}" or "${ELECTRON_APP_MODES.ATTACH}".`,
      );
  }
}

export function shouldPreserveLocalAppState(
  mode: TransactionToolAppMode = getElectronAppMode(),
): boolean {
  const override = readBooleanEnv(PRESERVE_LOCAL_APP_STATE_ENV);
  return override ?? mode === ELECTRON_APP_MODES.ATTACH;
}
