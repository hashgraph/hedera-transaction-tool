import { ipcMain, safeStorage } from 'electron';

import { USE_KEYCHAIN } from '@main/shared/constants';

import { addClaim, getClaims } from '@main/services/localUser/claim';
import { login, register } from '@main/services/localUser/auth';

const createChannelName = (...props) => ['safeStorage', ...props].join(':');

export const STATIC_USER = 'keychain@mode';

export default () => {
  /* Safe Storage */

  const getFlags = async () => {
    return await getClaims({
      where: {
        claim_key: USE_KEYCHAIN,
      },
    });
  };

  // Check if the platform is MacOS and has keychain available
  ipcMain.handle(createChannelName('isKeychainAvailable'), () => process.platform === 'darwin');

  // Initializes the flag for keychain mode, can be used only once
  ipcMain.handle(createChannelName('initializeUseKeychain'), async (_e, useKeychain: boolean) => {
    const flags = await getFlags();
    if (flags.length > 0) throw new Error('Keychain mode already initialized');

    /* Creates a fake user to store the keychain mode flag */
    const staticUser = await register(STATIC_USER, STATIC_USER);

    await addClaim(staticUser.id, USE_KEYCHAIN, useKeychain.toString());
  });

  // Get the use keychain flag
  ipcMain.handle(createChannelName('getUseKeychain'), async () => {
    const flags = await getFlags();
    if (flags.length === 0) throw new Error('Keychain mode not initialized');

    return flags[0].claim_value === 'true' ? true : false;
  });

  // Get the static user
  ipcMain.handle(createChannelName('getStaticUser'), async () => {
    const flags = await getFlags();
    if (flags.length === 0) throw new Error('Keychain mode not initialized');

    return await login(STATIC_USER, STATIC_USER);
  });

  // Encrypt data
  ipcMain.handle(createChannelName('encrypt'), async (_e, data: string) => {
    const buffer = safeStorage.encryptString(data);
    return buffer.toString('base64');
  });

  // Decrypt data
  ipcMain.handle(
    createChannelName('decrypt'),
    async (_e, encrypted: string, encoding?: BufferEncoding) => {
      return safeStorage.decryptString(Buffer.from(encrypted, encoding));
    },
  );
};
