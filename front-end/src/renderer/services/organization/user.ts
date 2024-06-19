import axios from 'axios';

import { IUser, IUserKey } from '@main/shared/interfaces';

import { getUserKeys } from './userKeys';
import { commonRequestHandler } from '@renderer/utils';

/* User service for organization */
const controller = 'users';

/* Get information about current user */
export const getUserState = async (organizationServerUrl: string) => {
  const { id, status, email, admin } = await getMe(organizationServerUrl);

  const user: {
    id: number;
    email: string;
    admin: boolean;
    passwordTemporary: boolean;
    userKeys: IUserKey[];
    secretHashes: string[];
  } = {
    id,
    email,
    admin,
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
export const getMe = async (organizationServerUrl: string): Promise<IUser> =>
  commonRequestHandler(async () => {
    const response = await axios.get(`${organizationServerUrl}/${controller}/me`, {
      withCredentials: true,
    });
    return response.data;
  }, 'Failed to get user information');

/* Get information about organization users */
export const getUsers = (organizationServerUrl: string): Promise<IUser[]> =>
  commonRequestHandler(async () => {
    const response = await axios.get(`${organizationServerUrl}/${controller}`, {
      withCredentials: true,
    });
    return response.data;
  }, 'Failed to get organization users');

/* ADMIN ONLY: Delete a user */
export const deleteUser = (organizationServerUrl: string, id) =>
  commonRequestHandler(async () => {
    const response = await axios.delete(`${organizationServerUrl}/${controller}/${id}`, {
      withCredentials: true,
    });
    return response.data;
  }, 'Failed to delete user');
