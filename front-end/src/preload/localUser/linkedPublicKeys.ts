import { ipcRenderer } from 'electron';
import { Prisma, PublicKeyLinked } from '@prisma/client';

export default {
  linkedPublicKeys: {
    createContactPublicKey: (
      user_id: string,
      publicKey: Prisma.PublicKeyLinkedUncheckedCreateInput,
    ): Promise<PublicKeyLinked[]> =>
      ipcRenderer.invoke('linkedPublicKeys:createPublicKeyLinked', user_id, publicKey),
    getLinkedPublicKeys: (userId: string): Promise<PublicKeyLinked[]> =>
      ipcRenderer.invoke('linkedPublicKeys:getLinkedPublicKeys', userId),
    deleteLinkedPublicKey: (id: string): Promise<PublicKeyLinked[]> =>
      ipcRenderer.invoke('linkedPublicKeys:deleteLinkedPublicKey', id),
  },
};
