import { KeyList } from '@hashgraph/sdk';
import { getMessageFromIPCError } from '@renderer/utils';
import { encodeKeyList } from '@renderer/utils/sdk';

/* Complex Keys Service */

/* Get all complex keys */
export const getComplexKeys = async (userId: string) => {
  try {
    return await window.electronAPI.complexKeys.getAll(userId);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to fetch complex keys'));
  }
};

/* Adds complex key */
export const addComplexKey = async (
  userId: string,
  encodedKeyList: Uint8Array,
  nickname: string,
) => {
  try {
    return await window.electronAPI.complexKeys.add(userId, encodedKeyList, nickname);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to save complex key'));
  }
};

/* Checks whether complex key is already added */
export const complexKeyExists = async (userId: string, keyListBytes: Uint8Array) => {
  try {
    return await window.electronAPI.complexKeys.complexKeyExists(userId, keyListBytes);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to check wheter complex key exists`));
  }
};

/* Removes complex key */
export const deleteComplexKey = async (userId: string, keyListBytes: Uint8Array) => {
  try {
    return await window.electronAPI.complexKeys.remove(userId, keyListBytes);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to remove complex key`));
  }
};

/* Updates complex key */
export const updateComplexKey = async (id: string, newKeyListBytes: Uint8Array) => {
  try {
    return await window.electronAPI.complexKeys.update(id, newKeyListBytes);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to update complex key`));
  }
};

export const getComplexKey = async (userId: string, keyList: KeyList) => {
  const bytes = encodeKeyList(keyList);

  const savedKeys = await getComplexKeys(userId);

  return savedKeys.find(key => {
    return key.protobufEncoded === bytes.toString();
  });
};
