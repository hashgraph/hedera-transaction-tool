import { getNodeAddressBook } from '@main/services/localUser';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* SDK */
  createIPCChannel('sdk', [renameFunc(getNodeAddressBook, 'getNodeAddressBook')]);
};
