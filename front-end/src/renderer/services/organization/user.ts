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
  userKeys: IUserKey[];
  secretHashes: string[];
}> => {
  const userKeys: IUserKey[] = [];
  const secretHashes: string[] = [];

  const keys = await getOwnKeys(organizationServerUrl, organizationUserId);
  userKeys.push(...keys);

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
    userKeys,
    secretHashes,
  };
};

/* Get information about current user */
export const getMe = async (
  organizationServerUrl: string,
): Promise<{
  id: number;
  email: string;
  admin: boolean;
}> => {
  try {
    const response = await axios.get(`${organizationServerUrl}/users/me`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed get user information');
  }
};

/* Changes the password */
export const changePassword = async (
  organizationServerUrl: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> => {
  try {
    const response = await axios.patch(
      `${organizationServerUrl}/users/change-password`,
      {
        oldPassword,
        newPassword,
      },
      {
        withCredentials: true,
      },
    );
    return response.data;
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed get user information');
  }
};
