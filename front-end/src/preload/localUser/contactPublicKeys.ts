import { getContactPublicKeys } from '@main/services/localUser';
import { ipcRenderer } from 'electron';
import { ContactPublicKey } from '@prisma/client';

export default {
  contactPublicKeys: {
    createContactPublicKey: (publicKey: string, contactId: string): Promise<ContactPublicKey[]> =>
      ipcRenderer.invoke('contactPublicKeys:createContactPublicKey', publicKey, contactId),
    getContactPublicKeys: (contactId: string): Promise<ContactPublicKey[]> =>
      ipcRenderer.invoke('contactPublicKeys:getContactPublicKeys', contactId),
  },
};
