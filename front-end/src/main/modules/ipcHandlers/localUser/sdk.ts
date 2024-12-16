import { getNodeAddressBook } from '@main/services/localUser';
import { createIPCChannel } from '@main/utils/electronInfra';

export default () => {
  /* SDK */
  createIPCChannel('sdk', [getNodeAddressBook]);
};
