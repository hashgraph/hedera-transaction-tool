import { ipcMain } from 'electron';

import {
  createLinkedPublicKey,
  getLinkedPublicKeys,
  deleteLinkedPublicKey,
} from '@main/services/localUser';
import { Prisma } from '@prisma/client';

const createChannelName = (...props) => ['linkedPublicKeys', ...props].join(':');

export default () => {
  /* Contact Public Key */

  // Get linked public keys
  ipcMain.handle(createChannelName('getLinkedPublicKeys'), (_e, userId: string) =>
    getLinkedPublicKeys(userId),
  );

  // Link Public Key
  ipcMain.handle(
    createChannelName('createLinkedPublicKey'),
    (_e, user_id: string, publicKey: Prisma.PublicKeyLinkedUncheckedCreateInput) =>
      createLinkedPublicKey(user_id, publicKey),
  );

  // Deletes Public Key
  ipcMain.handle(createChannelName('deleteLinkedPublicKey'), (_e, id: string) =>
    deleteLinkedPublicKey(id),
  );
};
