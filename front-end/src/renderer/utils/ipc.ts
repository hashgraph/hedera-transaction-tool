import { KEYCHAIN_UNAVAILABLE_MESSAGE } from '@shared/constants';

import useSafeStorage from '@renderer/stores/storeSafeStorage';

import { createLogger } from './logger';

const logger = createLogger('renderer.ipc');

export const getMessageFromIPCError = (err: any, msg: string) => {
  logger.error('IPC handler failed', err);
  return err.message?.split(': Error: ')[1] || msg;
};

export const commonIPCHandler = async <T>(callback: () => Promise<T>, defaultMessage: string) => {
  try {
    return await callback();
  } catch (error) {
    // Every local IPC call goes through here, so a keychain failure that propagates out of main shows the modal
    if (error instanceof Error && error.message.includes(KEYCHAIN_UNAVAILABLE_MESSAGE)) {
      useSafeStorage().keychainUnavailable = true;
    }
    throw Error(getMessageFromIPCError(error, defaultMessage));
  }
};
