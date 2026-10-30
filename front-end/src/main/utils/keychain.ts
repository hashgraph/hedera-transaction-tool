import { safeStorage } from 'electron';

import { KEYCHAIN_UNAVAILABLE_MESSAGE } from '@shared/constants';

import { getUseKeychainClaim } from '@main/services/localUser/claim';
import { createLogger } from '@main/modules/logger';

const logger = createLogger('main.utils.keychain');

/* Thrown when the OS keychain cannot be used (locked, denied, dismissed). The secret is intact. */
export class KeychainUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(KEYCHAIN_UNAVAILABLE_MESSAGE, { cause });
    // Keep the default name ('Error'): Electron stringifies IPC errors as `${error}` and the
    // renderer's getMessageFromIPCError only parses the ": Error: " form
  }
}

export const keychainDecrypt = (buffer: Buffer): string => {
  try {
    return safeStorage.decryptString(buffer);
  } catch (error) {
    logger.error('Keychain decrypt failed', { error });
    throw new KeychainUnavailableError(error);
  }
};

export const keychainEncrypt = (data: string): Buffer => {
  try {
    return safeStorage.encryptString(data);
  } catch (error) {
    logger.error('Keychain encrypt failed', { error });
    throw new KeychainUnavailableError(error);
  }
};

/* Probes the keychain with a canary encrypt/decrypt round trip. Returns false if it can't be used. */
export const probeKeychain = (): boolean => {
  try {
    const canary = 'keychain_canary';
    return safeStorage.decryptString(safeStorage.encryptString(canary)) === canary;
  } catch (error) {
    logger.warn('Keychain probe failed', { error });
    return false;
  }
};

/* Result of the probe done at startup, null if it was not run (not in keychain mode) */
let startupProbeResult: boolean | null = null;

/*
 * In keychain mode, probes the keychain before any window exists. The first keychain access
 * blocks the main process while macOS asks the user for permission, so doing it here keeps
 * the renderer from starting work (and timers) that would be stalled by the prompt.
 */
export const probeKeychainAtStartup = async (): Promise<void> => {
  try {
    if (!(await getUseKeychainClaim())) return;
  } catch {
    // Mode not initialized yet (first run), nothing stored to protect
    return;
  }
  startupProbeResult = probeKeychain();
};

/* Returns the startup probe result when available, otherwise probes now */
export const getKeychainStatus = (): boolean => startupProbeResult ?? probeKeychain();
