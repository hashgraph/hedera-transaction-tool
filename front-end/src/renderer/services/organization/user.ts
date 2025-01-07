import type { IUser, IUserKey } from '@main/shared/interfaces';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';

import { getUserKeys } from './userKeys';

/* User service for organization */
const controller = 'users';

/* Get information about current user */
export const getUserState = async (organizationServerUrl: string) => {
  const { id, status, email, admin, keys } = await getMe(organizationServerUrl);

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

  /* Backward compatibility */
  let userKeys: IUserKey[] = keys;
  if (!userKeys) {
    userKeys = await getUserKeys(organizationServerUrl, id);
  }

  user.userKeys.push(...userKeys);
  user.secretHashes.push(
    ...userKeys.reduce<string[]>((acc, curr) => {
      if (curr.mnemonicHash && !acc.includes(curr.mnemonicHash)) {
        acc.push(curr.mnemonicHash);
      }
      return acc;
    }, []),
  );

  return user;
};

/* Get information about current user */
export const getMe = async (organizationServerUrl: string): Promise<IUser> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get(`${organizationServerUrl}/${controller}/me`);
    return response.data;
  }, 'Failed to get user information');

/* Get information about organization users */
export const getUsers = (organizationServerUrl: string): Promise<IUser[]> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get(`${organizationServerUrl}/${controller}`);
    return response.data;
  }, 'Failed to get organization users');

/* ADMIN ONLY: Delete a user */
export const deleteUser = (organizationServerUrl: string, id: number) =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.delete(
      `${organizationServerUrl}/${controller}/${id}`,
    );
    return response.data;
  }, 'Failed to delete user');
