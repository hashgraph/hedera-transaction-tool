import { ipcMain } from 'electron';

import { createContactPublicKey, getContactPublicKeys } from '@main/services/localUser';

const createChannelName = (...props) => ['contactPublicKeys', ...props].join(':');

export default () => {
  /* Contact Public Key */

  // Get contact public keys
  ipcMain.handle(createChannelName('getContactPublicKeys'), (_e, contactId: string) =>
    getContactPublicKeys(contactId),
  );

  // Create Public Key
  ipcMain.handle(
    createChannelName('createContactPublicKey'),
    (_e, publicKey: string, contactId: string) => createContactPublicKey(publicKey, contactId),
  );
};
