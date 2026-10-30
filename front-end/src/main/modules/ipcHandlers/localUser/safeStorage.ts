import { ipcMain } from 'electron';

import { getKeychainStatus } from '@main/utils/keychain';

import { STATIC_USER } from '@shared/constants';

import { getUseKeychainClaim } from '@main/services/localUser/claim';
import { login } from '@main/services/localUser/auth';

import { initializeUseKeychain } from '@main/services/localUser/encryptionMode';

const createChannelName = (...props) => ['safeStorage', ...props].join(':');

export default () => {
  /* Safe Storage */

  // Check if the platform is MacOS and has keychain available
  ipcMain.handle(createChannelName('isKeychainAvailable'), () => process.platform === 'darwin');

  // Initializes the flag for keychain mode, can be used only once
  ipcMain.handle(createChannelName('initializeUseKeychain'), async (_e, useKeychain: boolean) => {
    await initializeUseKeychain(useKeychain);
  });

  // Get the use keychain flag
  ipcMain.handle(createChannelName('getUseKeychain'), async () => {
    return await getUseKeychainClaim();
  });

  // Get the static user
  ipcMain.handle(createChannelName('getStaticUser'), async () => {
    await getUseKeychainClaim();

    return await login(STATIC_USER, STATIC_USER);
  });

  // Probe the keychain with a canary round trip
  ipcMain.handle(createChannelName('checkKeychain'), () => getKeychainStatus());
};
