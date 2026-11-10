import { Prisma } from '@prisma/client';

import { commonIPCHandler } from '@renderer/utils';

export const getAll = async (findArgs: Prisma.SmartContractFindManyArgs) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.smartContracts.getAll(findArgs);
  }, 'Failed to get smart contracts');

export const add = async (contract: Prisma.SmartContractUncheckedCreateInput) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.smartContracts.add(contract);
  }, 'Smart contract save failed');

export const update = async (
  id: string,
  userId: string,
  contract: Prisma.SmartContractUncheckedUpdateInput,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.smartContracts.update(id, userId, contract);
  }, 'Smart contract update failed');

export const remove = async (userId: string, ids: string[]) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.smartContracts.remove(userId, ids);
  }, 'Smart contract removal failed');
