import { ipcRenderer } from 'electron';
import { proto } from '@hiero-ledger/proto';

export default {
  sdk: {
    getNodeAddressBook: (mirrorNetwork: string): Promise<proto.INodeAddressBook> =>
      ipcRenderer.invoke('sdk:getNodeAddressBook', mirrorNetwork),
  },
};
