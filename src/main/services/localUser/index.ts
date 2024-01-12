import * as authService from './auth';
export * from './auth';

import * as keyPairsService from './keyPairs';
export * from './keyPairs';

export const getUserStorageFolderPath = (email: string) => `User Storage/${email}`;

export const resetData = async (
  email: string,
  options: { authData?: boolean; keys?: boolean; transactions?: boolean; organizations?: boolean },
) => {
  if (options.authData) {
    await authService.clear(email);
  }
  if (options.keys) {
    await keyPairsService.deleteSecretHashes(email);
  }
};
