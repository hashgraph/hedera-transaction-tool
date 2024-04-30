import { IUserKey } from '@main/shared/interfaces';
import axios from 'axios';

/* User keys service for organization */

const controller = ['user', 'keys'];

/* Get keys for a user from organization */
export const getUserKeys = async (
  organizationServerUrl: string,
  organizationUserId: number,
): Promise<IUserKey[]> => {
  try {
    const response = await axios.get(
      `${organizationServerUrl}/${controller[0]}/${organizationUserId}/${controller[1]}`,
      {
        withCredentials: true,
      },
    );

    return response.data;
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed get user keys');
  }
};

/* Uploads a key to the organization */
export const uploadKey = async (
  organizationServerUrl: string,
  organizationUserId: number,
  key: { publicKey: string; index?: number; mnemonicHash?: string },
) => {
  try {
    await axios.post(
      `${organizationServerUrl}/${controller[0]}/${organizationUserId}/${controller[1]}`,
      key,
      {
        withCredentials: true,
      },
    );
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed to upload user key');
  }
};

/* Deletes a key from the organization */
export const deleteKey = async (
  organizationServerUrl: string,
  organizationUserId: number,
  keyId: number,
) => {
  try {
    await axios.delete(
      `${organizationServerUrl}/${controller[0]}/${organizationUserId}/${controller[1]}/${keyId}`,
      {
        withCredentials: true,
      },
    );
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed to delete user key');
  }
};
