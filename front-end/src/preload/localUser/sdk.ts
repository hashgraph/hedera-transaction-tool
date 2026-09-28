import { ipcRenderer } from 'electron';
import { proto } from '@hiero-ledger/proto';

export interface SdkAPI {
  getNodeAddressBook(mirrorNetwork: string): Promise<proto.INodeAddressBook>;
}

const api: SdkAPI = {
  getNodeAddressBook: (mirrorNetwork: string): Promise<proto.INodeAddressBook> =>
    ipcRenderer.invoke('sdk:getNodeAddressBook', mirrorNetwork),
}

export default { sdk: api };
