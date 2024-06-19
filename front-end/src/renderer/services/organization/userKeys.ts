import axios from 'axios';

import { IUserKey } from '@main/shared/interfaces';

import { commonRequestHandler } from '@renderer/utils';

/* User keys service for organization */

const controller = ['user', 'keys'];

/* Get keys for a user from organization */
export const getUserKeys = async (
  organizationServerUrl: string,
  organizationUserId: number,
): Promise<IUserKey[]> =>
  commonRequestHandler(async () => {
    const response = await axios.get(
      `${organizationServerUrl}/${controller[0]}/${organizationUserId}/${controller[1]}`,
      {
        withCredentials: true,
      },
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
    await axios.post(
      `${organizationServerUrl}/${controller[0]}/${organizationUserId}/${controller[1]}`,
      key,
      {
        withCredentials: true,
      },
    );
  }, 'Failed to upload user key');

/* Deletes a key from the organization */
export const deleteKey = async (
  organizationServerUrl: string,
  organizationUserId: number,
  keyId: number,
) =>
  commonRequestHandler(async () => {
    await axios.delete(
      `${organizationServerUrl}/${controller[0]}/${organizationUserId}/${controller[1]}/${keyId}`,
      {
        withCredentials: true,
      },
    );
  }, 'Failed to delete user key');
