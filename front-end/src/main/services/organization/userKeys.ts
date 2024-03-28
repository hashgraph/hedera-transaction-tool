import axios from 'axios';

import { getRequestMeta } from '.';

/* User keys service for organization */

const controller = ['user', 'keys'];

/* Get user keys from organization */
export const getOwn = async (organizationId: string, userId: string) => {
  try {
    const { organization, accessToken, jwtPayload } = await getRequestMeta(userId, organizationId);

    const response = await axios.get(
      `${organization?.serverUrl}/${controller[0]}/${jwtPayload.userId}/${controller[1]}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return response.data;
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed get user keys');
  }
};

/* Uploads a key to the organization */
export const upload = async (
  organizationId: string,
  userId: string,
  key: { publicKey: string; index?: number; mnemonicHash?: string },
) => {
  try {
    const { organization, accessToken } = await getRequestMeta(userId, organizationId);

    await axios.post(
      `${organization?.serverUrl}/${controller[0]}/${userId}/${controller[1]}`,
      key,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed to upload user key');
  }
};

/* Deletes a key from the organization */
export const deleteKey = async (organizationId: string, userId: string, keyId: number) => {
  try {
    const { organization, accessToken } = await getRequestMeta(userId, organizationId);

    await axios.delete(
      `${organization?.serverUrl}/${controller[0]}/${userId}/${controller[1]}/${keyId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed to delete user key');
  }
};
