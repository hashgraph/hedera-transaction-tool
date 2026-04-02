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
    throw Error(getMessageFromIPCError(error, defaultMessage));
  }
};
