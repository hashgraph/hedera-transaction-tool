import type { IUserKey } from '@main/shared/interfaces';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';

/* User keys service for organization */

const controller = ['user', 'keys'];

/* Get keys for a user from organization */
export const getUserKeys = async (
  organizationServerUrl: string,
  organizationUserId: number,
): Promise<IUserKey[]> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get(
      `${organizationServerUrl}/${controller[0]}/${organizationUserId}/${controller[1]}`,
    );

    return response.data;
  }, 'Failed to get user keys');

/* Uploads a key to the organization */
export const uploadKey = async (
  organizationServerUrl: string,
  organizationUserId: number,
  key: { publicKey: string; index?: number; mnemonicHash?: string },
) =>
  commonRequestHandler(async () => {
    await axiosWithCredentials.post(
      `${organizationServerUrl}/${controller[0]}/${organizationUserId}/${controller[1]}`,
      key,
    );
  }, 'Failed to upload user key');

/* Deletes a key from the organization */
export const deleteKey = async (
  organizationServerUrl: string,
  organizationUserId: number,
  keyId: number,
) =>
  commonRequestHandler(async () => {
    await axiosWithCredentials.delete(
      `${organizationServerUrl}/${controller[0]}/${organizationUserId}/${controller[1]}/${keyId}`,
    );
  }, 'Failed to delete user key');

/* Update key's recovery phrase hash and/or index from the organization */
export const updateKey = async (
  organizationServerUrl: string,
  organizationUserId: number,
  keyId: number,
  mnemonicHash: string,
  index?: number,
) =>
  commonRequestHandler(async () => {
    await axiosWithCredentials.patch(
      `${organizationServerUrl}/${controller[0]}/${organizationUserId}/${controller[1]}/${keyId}`,
      {
        mnemonicHash,
        index,
      },
    );
  }, 'Failed to update user key');
