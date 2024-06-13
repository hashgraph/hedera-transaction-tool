import { expect, vi } from 'vitest';

import { HederaAccount } from '@prisma/client';

import prisma from '@main/db/__mocks__/prisma';

import { Network } from '@main/shared/enums';

import {
  addAccount,
  changeAccountNickname,
  getAccounts,
  removeAccounts,
} from '@main/services/localUser/accounts';

vi.mock('@main/db/prisma');

describe('Services Local User Accounts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getAccounts', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should get the accounts by a find arguments', async () => {
      const records: HederaAccount[] = [
        {
          id: '321',
          user_id: '123',
          account_id: '0.0.2',
          nickname: 'treasury',
          network: 'net',
          created_at: new Date(),
        },
      ];
      prisma.hederaAccount.findMany.mockResolvedValueOnce(records);

      const result = await getAccounts({});

      expect(result).toEqual(records);
    });

    test('Should return empty array on error', async () => {
      prisma.hederaAccount.findMany.mockImplementationOnce(() => {
        throw new Error('Database Error');
      });

      const result = await getAccounts({});

      expect(result).toEqual([]);
    });
  });

  describe('addAccount', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    const userId: string = '123';
    const accountId: string = '0.0.2';
    const network: Network = Network.TESTNET;
    const nickname: string = 'A Nickname';

    test('Should add an account with provided arguments', async () => {
      const newUser = {
        id: '321',
        user_id: userId,
        account_id: accountId,
        nickname,
        network,
        created_at: new Date(),
      };

      prisma.hederaAccount.count.mockResolvedValueOnce(0);
      prisma.hederaAccount.findMany.mockResolvedValueOnce([newUser]);

      const result = await addAccount(
        newUser.user_id,
        newUser.account_id,
        newUser.network,
        newUser.nickname,
      );

      expect(result).toStrictEqual([newUser]);
    });

    test('Should add an account with provided arguments without nickname', async () => {
      const newUser = {
        id: '321',
        user_id: userId,
        account_id: accountId,
        nickname: '',
        network,
        created_at: new Date(),
      };

      prisma.hederaAccount.count.mockResolvedValueOnce(0);
      prisma.hederaAccount.findMany.mockResolvedValueOnce([newUser]);

      const result = await addAccount(
        newUser.user_id,
        newUser.account_id,
        newUser.network,
        newUser.nickname,
      );

      expect(result).toStrictEqual([newUser]);
    });

    test('Should throw error if account already exists', async () => {
      prisma.hederaAccount.count.mockResolvedValueOnce(1);

      expect(addAccount(userId, accountId, network, nickname)).rejects.toThrowError(
        'Account ID or Nickname already exists!',
      );
    });
  });

  describe('removeAccounts', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should remove accounts by userId and accountIds', async () => {
      const userId: string = '123';
      const accountIds: string[] = ['0.0.2', '0.0.3'];

      await removeAccounts(userId, accountIds);

      expect(prisma.hederaAccount.deleteMany).toHaveBeenCalledOnce();
    });
  });

  describe('changeNickname', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should change the nickname of an account', async () => {
      const userId: string = '123';
      const accountId: string = '0.0.2';
      const nickname: string = 'A New Nickname';

      await changeAccountNickname(userId, accountId, nickname);

      expect(prisma.hederaAccount.updateMany).toHaveBeenCalledOnce();
    });
  });
});
