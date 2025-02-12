import { KeyList } from '@hashgraph/sdk';

import { commonIPCHandler, encodeKey } from '@renderer/utils';

/* Complex Keys Service */

/* Get all complex keys */
export const getComplexKeys = async (userId: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.complexKeys.getAll(userId);
  }, 'Failed to fetch complex keys');

/* Adds complex key */
export const addComplexKey = async (userId: string, encodedKeyList: Uint8Array, nickname: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.complexKeys.add(userId, encodedKeyList, nickname);
  }, 'Failed to save complex key');

/* Gets particular complex key of a user */
export const getComplexKey = async (userId: string, keyList: KeyList) => {
  const keyListBytes = encodeKey(keyList);

  return await commonIPCHandler(async () => {
    return await window.electronAPI.local.complexKeys.getComplexKey(userId, keyListBytes);
  }, 'Failed to fetch complex key');
};

/* Removes complex key */
export const deleteComplexKey = async (id: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.complexKeys.delete(id);
  }, `Failed to remove complex key`);

/* Updates complex key */
export const updateComplexKey = async (id: string, newKeyListBytes?: Uint8Array, nickname?: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.complexKeys.update(id, newKeyListBytes, nickname);
  }, `Failed to update complex key`);
