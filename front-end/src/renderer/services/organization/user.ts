import type { IUser, IUserKey } from '@shared/interfaces';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';

import { getUserKeys } from './userKeys';

import {
  PUBLIC_KEY_OWNER_DEFAULT_MESSAGE,
  PUBLIC_KEY_OWNER_STATUS_MESSAGES,
} from './errorMessages';
import type { Organization } from '@prisma/client';

/* User service for organization */
const controller = 'users';

/* Get information about current user */
export const getUserState = async (organization: Organization) => {
  const { id, status, email, admin, keys } = await getMe(organization);

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
    userKeys = await getUserKeys(organization, id);
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
export const getMe = async (organization: Organization): Promise<IUser> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get(organization, `${controller}/me`);
    return response.data;
  }, 'Failed to get user information');

/* Get information about organization users */
export const getUsers = (organization: Organization): Promise<IUser[]> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get(organization, `${controller}`);
    return response.data;
  }, 'Failed to get organization users');

/* ADMIN ONLY: Delete a user */
export const deleteUser = (organization: Organization, id: number) =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.delete(organization, `${controller}/${id}`);
    return response.data;
  }, 'Failed to delete user');

export const getPublicKeyOwner = async (
  organization: Organization,
  publicKey: string,
): Promise<string | null> => {
  return commonRequestHandler(
    async () => {
      const response = await axiosWithCredentials.get(
        organization,
        `${controller}/public-owner/${publicKey}`,
      );
      // response.data == "" when there is no matching user => fixing
      return response.data === '' ? null : response.data;
    },
    PUBLIC_KEY_OWNER_DEFAULT_MESSAGE,
    PUBLIC_KEY_OWNER_STATUS_MESSAGES[401],
    PUBLIC_KEY_OWNER_STATUS_MESSAGES,
  );
};
