import axios from 'axios';

import { IUserKey } from '@main/shared/interfaces';

import { getOwnKeys } from './userKeys';

/* User service for organization */

/* Get information about current user */
export const getUserState = async (
  organizationServerUrl: string,
  organizationUserId: number,
): Promise<{
  passwordTemporary: boolean;
  organizationKeys: IUserKey[];
  secretHashes: string[];
}> => {
  const organizationKeys: IUserKey[] = [];
  const secretHashes: string[] = [];

  const keys = await getOwnKeys(organizationServerUrl, organizationUserId);
  organizationKeys.push(...keys);

  secretHashes.push(
    ...keys.reduce((acc, curr) => {
      if (curr.mnemonicHash && !acc.includes(curr.mnemonicHash)) {
        acc.push(curr.mnemonicHash);
      }
      return acc;
    }, [] as string[]),
  );

  // try {
  //   const _data = await window.electronAPI.organization.user.me(organizationServerUrl, userId);
  // } catch (error: any) {
  //   throw Error(getMessageFromIPCError(error, 'Failed to get information about user state'));
  // }

  return {
    passwordTemporary: false,
    organizationKeys,
    secretHashes,
  };
};

/* Get information about current user */
export const getMe = async (organizationServerUrl: string) => {
  try {
    const response = await axios.get(`${organizationServerUrl}/users/me`, {
      withCredentials: true,
    });

    return response.data.id;
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed get user keys');
  }
};
