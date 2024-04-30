import axios from 'axios';

import { IUserKey } from '@main/shared/interfaces';

import { getUserKeys } from './userKeys';

/* User service for organization */
const controller = 'users';

/* Get information about current user */
export const getUserState = async (organizationServerUrl: string) => {
  const { id, status, email } = await getMe(organizationServerUrl);

  const user: {
    id: number;
    email: string;
    passwordTemporary: boolean;
    userKeys: IUserKey[];
    secretHashes: string[];
  } = {
    id,
    email,
    passwordTemporary: status === 'NEW',
    userKeys: [],
    secretHashes: [],
  };

  if (user.passwordTemporary) return user;

  const keys = await getUserKeys(organizationServerUrl, id);

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
    const response = await axios.get(`${organizationServerUrl}/${controller}/me`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed get user information');
  }
};

/* Get information about organization users */
export async function getUsers(organizationServerUrl: string): Promise<
  {
    id: number;
    email: string;
    status: 'NEW' | 'NONE';
    admin: boolean;
  }[]
> {
  try {
    const response = await axios.get(`${organizationServerUrl}/${controller}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed to get organization users');
  }
}

/* ADMIN ONLY: Delete a user */
export async function deleteUser(organizationServerUrl: string, id) {
  try {
    const response = await axios.delete(`${organizationServerUrl}/${controller}/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    console.log(error);
    throw new Error('Failed to delete user');
  }
}
