import { getMessageFromIPCError } from '@renderer/utils';

export const getAssociatedAccounts = async (contactId: string) => {
  try {
    return await window.electronAPI.local.associatedAccounts.getAssociatedAccounts(contactId);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to get linked contacts'));
  }
};
