import type { Network } from '@main/shared/interfaces';

import { Prisma } from '@prisma/client';

import { commonIPCHandler } from '@renderer/utils';

export const getAll = async (findArgs: Prisma.HederaAccountFindManyArgs) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.accounts.getAll(findArgs);
  }, 'Failed to get linked acccounts');

export const getOne = async (userId: string, accountId: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.accounts.getOne(userId, accountId);
  }, 'Failed to get the account');

export const add = async (
  userId: string,
  accountId: string,
  network: Network,
  nickname: string = '',
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.accounts.add(userId, accountId, network, nickname);
  }, 'Account link failed');

export const remove = async (userId: string, accountIds: string[]) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.accounts.remove(userId, accountIds);
  }, 'Account unlink failed');

export const changeNickname = async (userId: string, accountId: string, nickname: string = '') =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.accounts.changeNickname(userId, accountId, nickname);
  }, 'Account nickname change failed');
