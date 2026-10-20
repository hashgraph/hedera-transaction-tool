import { ipcMain, safeStorage } from 'electron';

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

  // Encrypt data
  ipcMain.handle(createChannelName('encrypt'), (_e, data: string) => {
    const buffer = safeStorage.encryptString(data);
    return buffer.toString('base64');
  });

  // Decrypt data
  ipcMain.handle(
    createChannelName('decrypt'),
    (_e, encrypted: string, encoding?: BufferEncoding) => {
      return safeStorage.decryptString(Buffer.from(encrypted, encoding));
    },
  );
};
