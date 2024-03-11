import { Prisma } from '@prisma/client';

import { getMessageFromIPCError } from '@renderer/utils';

/* Complex Keys Service */

/* Get all complex keys */
export const getDrafts = async (userId: string) => {
  try {
    return await window.electronAPI.complexKeys.getAll(userId);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to fetch complex keys'));
  }
};

/* Adds complex key */
export const addComplexKey = async (userId: string, protobufEncoded: string, nickname: string) => {
  const complexKey: Prisma.ComplexKeyUncheckedCreateInput = {
    user_id: userId,
    protobufEncoded,
    nickname,
  };

  try {
    return await window.electronAPI.complexKeys.add(complexKey);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to save complex key'));
  }
};

/* Checks whether complex key is already added */
export const complexKeyExists = async (userId: string, protobufEncoded: string) => {
  try {
    return await window.electronAPI.complexKeys.complexKeyExists(userId, protobufEncoded);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to check wheter complex key exists`));
  }
};

/* Removes complex key */
export const deleteComplexKey = async (userId: string, protobufEncoded: string) => {
  try {
    return await window.electronAPI.complexKeys.remove(userId, protobufEncoded);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to remove complex key`));
  }
};

/* Updates complex key */
export const updateComplexKey = async (
  userId: string,
  oldProtobufEncoded: string,
  newProtobufEncoded: string,
) => {
  try {
    return await window.electronAPI.complexKeys.update(
      userId,
      oldProtobufEncoded,
      newProtobufEncoded,
    );
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to update complex key`));
  }
};
