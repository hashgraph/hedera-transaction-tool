import path from 'path';
import fs from 'fs/promises';

import * as authService from './auth';
export * from './auth';

import * as keyPairsService from './keyPairs';
export * from './keyPairs';

export const userStorageFolderName = 'User Storage';
export const getUserStorageFolderPath = (email: string) => `User Storage/${email}`;

export const resetData = async (
  userDataPath: string,
  options?: {
    email: string;
    authData?: boolean;
    keys?: boolean;
    transactions?: boolean;
    organizations?: boolean;
  },
) => {
  if (options) {
    if (options.authData) {
      await authService.clear(options.email);
    }
    if (options.keys) {
      await keyPairsService.deleteSecretHashes(options.email);
    }
  } else {
    try {
      const userStoragePath = path.join(userDataPath, userStorageFolderName);
      await fs.rmdir(userStoragePath, {
        recursive: true,
      });
    } catch (error) {
      console.log(error);
    }
  }
};
