import { Prisma } from '@prisma/client';

import { getPrismaClient } from '@main/db/prisma';
import { createLogger } from '@main/modules/logger';

const logger = createLogger('main.localUser.smartContracts');

export const getSmartContracts = async (findArgs: Prisma.SmartContractFindManyArgs) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.smartContract.findMany(findArgs);
  } catch (error) {
    logger.error('Failed to get smart contracts', { error });
    return [];
  }
};

export const addSmartContract = async (contract: Prisma.SmartContractUncheckedCreateInput) => {
  if (
    (!contract.contract_id || contract.contract_id.trim().length === 0) &&
    (!contract.evm_address || contract.evm_address.trim().length === 0)
  ) {
    throw new Error('Either a Contract ID or an EVM address is required');
  }

  const prisma = getPrismaClient();

  const nickname =
    contract.nickname && contract.nickname.trim().length > 0 ? contract.nickname.trim() : null;

  const alreadyAddedCount = await prisma.smartContract.count({
    where: {
      user_id: contract.user_id,
      OR: [
        ...(contract.contract_id
          ? [{ contract_id: contract.contract_id, network: contract.network }]
          : []),
        ...(contract.evm_address
          ? [{ evm_address: contract.evm_address, network: contract.network }]
          : []),
        ...(nickname ? [{ nickname, network: contract.network }] : []),
      ],
    },
  });

  if (alreadyAddedCount > 0) {
    throw new Error('Contract ID, EVM address, or Nickname already exists!');
  }

  delete contract.id;

  await prisma.smartContract.create({
    data: {
      ...contract,
      nickname,
    },
  });

  return await getSmartContracts({
    where: {
      user_id: contract.user_id,
    },
  });
};

export const updateSmartContract = async (
  id: string,
  userId: string,
  contract: Prisma.SmartContractUncheckedUpdateInput,
) => {
  const prisma = getPrismaClient();

  await prisma.smartContract.updateMany({
    where: {
      id,
      user_id: userId,
    },
    data: {
      ...contract,
      // Only touch nickname when it was explicitly provided (partial updates must not clear it)
      ...(contract.nickname !== undefined && {
        nickname:
          typeof contract.nickname === 'string' && contract.nickname.trim().length > 0
            ? contract.nickname.trim()
            : null,
      }),
      user_id: userId,
    },
  });

  return await getSmartContracts({
    where: {
      user_id: userId,
    },
  });
};

export const removeSmartContracts = async (userId: string, ids: string[]) => {
  const prisma = getPrismaClient();

  await prisma.smartContract.deleteMany({
    where: {
      user_id: userId,
      id: {
        in: ids,
      },
    },
  });
};
