import type { IUserKey, PaginatedResourceDto } from '@main/shared/interfaces';

import { axiosWithCredentials, commonRequestHandler, safeAwait } from '@renderer/utils';

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

/* Get all users keys from organization */
export const getUserKeysPaginated = async (
  organizationServerUrl: string,
  page: number,
  size: number,
): Promise<PaginatedResourceDto<IUserKey>> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get(
      `${organizationServerUrl}/user-keys?page=${page}&size=${size}`,
    );

    return response.data;
  }, 'Failed to get user keys');

export const getAllUserKeys = async (organizationServerUrl: string): Promise<IUserKey[]> => {
  let page = 1;
  const size = 100;
  let totalItems = 0;
  const allUserKeys: IUserKey[] = [];

  do {
    const { data, error } = await safeAwait(
      getUserKeysPaginated(organizationServerUrl, page, size),
    );
    if (data) {
      totalItems = data.totalItems;
      allUserKeys.push(...data.items);
      page++;
    }

    if (error) {
      break;
    }
  } while (allUserKeys.length < totalItems);

  return allUserKeys;
};
