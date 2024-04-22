import { ipcRenderer } from 'electron';

import { AssociatedAccount } from '@prisma/client';

export default {
  associatedAccounts: {
    getAssociatedAccounts: (contactId: string): Promise<AssociatedAccount[]> =>
      ipcRenderer.invoke('associatedAccounts:getAssociatedAccounts', contactId),
  },
};
