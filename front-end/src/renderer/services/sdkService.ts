import type { proto } from '@hashgraph/proto';

import { commonIPCHandler } from '@renderer/utils';

export const getNodeAddressBook = async (mirrorNetwork: string) =>
  commonIPCHandler<proto.INodeAddressBook>(async () => {
    return await window.electronAPI.local.sdk.getNodeAddressBook(mirrorNetwork);
  }, 'Failed to get node address book');
