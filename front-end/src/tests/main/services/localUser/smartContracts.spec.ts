import { expect, vi } from 'vitest';

import prisma from '@main/db/__mocks__/prisma';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));
vi.mock('@main/modules/logger', () => ({
  createLogger: () => mockLogger,
}));
vi.mock('@main/db/prisma');

import {
  addSmartContract,
  getSmartContracts,
  removeSmartContracts,
  updateSmartContract,
} from '@main/services/localUser/smartContracts';

describe('Services Local User Smart Contracts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getSmartContracts', () => {
    test('Should query with the given find arguments', async () => {
      const records = [{ id: '1' }];
      prisma.smartContract.findMany.mockResolvedValueOnce(records as never);
      const args = { where: { user_id: 'u' } };

      expect(await getSmartContracts(args)).toEqual(records);
      expect(prisma.smartContract.findMany).toHaveBeenCalledWith(args);
    });

    test('Should return an empty array when the query rejects', async () => {
      prisma.smartContract.findMany.mockRejectedValueOnce(new Error('db'));

      expect(await getSmartContracts({})).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('addSmartContract', () => {
    const base = { user_id: 'u', network: 'testnet' } as never as {
      user_id: string;
      network: string;
      id?: string;
      contract_id?: string;
      evm_address?: string;
      nickname?: string | null;
    };

    test.each([
      ['both missing', {}],
      ['both blank', { contract_id: '  ', evm_address: '' }],
    ])('Should reject when neither contract id nor evm address given (%s)', async (_n, extra) => {
      await expect(addSmartContract({ ...base, ...extra } as never)).rejects.toThrow(
        'Either a Contract ID or an EVM address is required',
      );
      expect(prisma.smartContract.create).not.toHaveBeenCalled();
    });

    test('Should check duplicates on all identifiers within the same user and network, then create', async () => {
      prisma.smartContract.count.mockResolvedValueOnce(0);
      prisma.smartContract.findMany.mockResolvedValueOnce([{ id: 'n' }] as never);

      const result = await addSmartContract({
        ...base,
        id: 'client-id',
        contract_id: '0.0.5',
        evm_address: '0xabc',
        nickname: '  My Token  ',
      } as never);

      expect(prisma.smartContract.count).toHaveBeenCalledWith({
        where: {
          user_id: 'u',
          OR: [
            { contract_id: '0.0.5', network: 'testnet' },
            { evm_address: '0xabc', network: 'testnet' },
            { nickname: 'My Token', network: 'testnet' },
          ],
        },
      });
      const data = prisma.smartContract.create.mock.calls[0][0].data as Record<string, unknown>;
      expect(data.nickname).toBe('My Token');
      expect(data).not.toHaveProperty('id');
      expect(data).toMatchObject({ contract_id: '0.0.5', evm_address: '0xabc', user_id: 'u' });
      expect(prisma.smartContract.findMany).toHaveBeenCalledWith({ where: { user_id: 'u' } });
      expect(result).toEqual([{ id: 'n' }]);
    });

    test('Should only check provided identifiers and store a blank nickname as null', async () => {
      prisma.smartContract.count.mockResolvedValueOnce(0);
      prisma.smartContract.findMany.mockResolvedValueOnce([]);

      await addSmartContract({ ...base, evm_address: '0xabc', nickname: '   ' } as never);

      expect(prisma.smartContract.count).toHaveBeenCalledWith({
        where: { user_id: 'u', OR: [{ evm_address: '0xabc', network: 'testnet' }] },
      });
      expect(prisma.smartContract.create.mock.calls[0][0].data.nickname).toBeNull();
    });

    test('Should only check contract id when evm address is missing; missing nickname -> null', async () => {
      prisma.smartContract.count.mockResolvedValueOnce(0);
      prisma.smartContract.findMany.mockResolvedValueOnce([]);

      await addSmartContract({ ...base, contract_id: '0.0.5' } as never);

      expect(prisma.smartContract.count).toHaveBeenCalledWith({
        where: { user_id: 'u', OR: [{ contract_id: '0.0.5', network: 'testnet' }] },
      });
      expect(prisma.smartContract.create.mock.calls[0][0].data.nickname).toBeNull();
    });

    test('Should reject duplicates without creating', async () => {
      prisma.smartContract.count.mockResolvedValueOnce(1);

      await expect(addSmartContract({ ...base, contract_id: '0.0.5' } as never)).rejects.toThrow(
        'Contract ID, EVM address, or Nickname already exists!',
      );
      expect(prisma.smartContract.create).not.toHaveBeenCalled();
    });
  });

  describe('updateSmartContract', () => {
    test('Should scope by id and user, force user_id, trim nickname and return the user list', async () => {
      prisma.smartContract.findMany.mockResolvedValueOnce([{ id: '1' }] as never);

      const result = await updateSmartContract('1', 'u', {
        nickname: '  Nick ',
        user_id: 'attacker',
      });

      expect(prisma.smartContract.updateMany).toHaveBeenCalledWith({
        where: { id: '1', user_id: 'u' },
        data: { nickname: 'Nick', user_id: 'u' },
      });
      expect(prisma.smartContract.findMany).toHaveBeenCalledWith({ where: { user_id: 'u' } });
      expect(result).toEqual([{ id: '1' }]);
    });

    test.each([['   '], [null]])('Should clear nickname when given %j', async nickname => {
      await updateSmartContract('1', 'u', { nickname });
      expect(prisma.smartContract.updateMany.mock.calls[0][0].data.nickname).toBeNull();
    });

    test('Should not touch nickname when it is not provided (partial update)', async () => {
      await updateSmartContract('1', 'u', { contract_id: '0.0.9' });
      const data = prisma.smartContract.updateMany.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('nickname');
      expect(data).toMatchObject({ contract_id: '0.0.9', user_id: 'u' });
    });
  });

  describe('removeSmartContracts', () => {
    test('Should delete only the given ids owned by the user', async () => {
      await removeSmartContracts('u', ['1', '2']);
      expect(prisma.smartContract.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 'u', id: { in: ['1', '2'] } },
      });
    });
  });
});
