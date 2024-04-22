import { getMessageFromIPCError } from '@renderer/utils';

export const addContactPublicKey = async (publicKey: string, contactId: string) => {
  try {
    return await window.electronAPI.local.contactPublicKeys.createContactPublicKey(
      publicKey,
      contactId,
    );
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Contact add failed'));
  }
};

export async function getContactPublicKeys(contactId: string) {
  try {
    return await window.electronAPI.local.contactPublicKeys.getContactPublicKeys(contactId);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Contact add failed'));
  }
}
