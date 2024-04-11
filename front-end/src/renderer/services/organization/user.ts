import axios from 'axios';

import { IUserKey } from '@main/shared/interfaces';

import { getOwnKeys } from './userKeys';

/* User service for organization */

/* Get information about current user */
export const getUserState = async (organizationServerUrl: string) => {
  const { id, status } = await getMe(organizationServerUrl);

  const user: {
    id: number;
    passwordTemporary: boolean;
    userKeys: IUserKey[];
    secretHashes: string[];
  } = {
    id,
    passwordTemporary: status === 'NEW',
    userKeys: [],
    secretHashes: [],
  };

  if (user.passwordTemporary) return user;

  const keys = await getOwnKeys(organizationServerUrl, id);

  user.userKeys.push(...keys);
  user.secretHashes.push(
    ...keys.reduce((acc, curr) => {
      if (curr.mnemonicHash && !acc.includes(curr.mnemonicHash)) {
        acc.push(curr.mnemonicHash);
      }
      return acc;
    }, [] as string[]),
  );

  return user;
};

/* Get information about current user */
export const getMe = async (
  organizationServerUrl: string,
): Promise<{
  id: number;
  email: string;
  status: 'NEW' | 'NONE';
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
