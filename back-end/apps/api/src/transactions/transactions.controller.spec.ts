import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { mockDeep } from 'jest-mock-extended';
import { EntityManager } from 'typeorm';

import { BlacklistService, guardMock, Pagination } from '@app/common';
import {
  Network,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
  UserStatus,
} from '@entities';

import { HasKeyGuard, VerifiedUserGuard } from '../guards';

import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let user: User;
  let transaction: Transaction;
  let pagination: Pagination;

  const transactionService = mockDeep<TransactionsService>();
  const entityManager = mockDeep<EntityManager>();
  const blacklistService = mockDeep<BlacklistService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: transactionService,
        },
        {
          provide: EntityManager,
          useValue: entityManager,
        },
        {
          provide: BlacklistService,
          useValue: blacklistService,
        },
      ],
    })
      .overrideGuard(HasKeyGuard)
      .useValue(guardMock())
      .overrideGuard(VerifiedUserGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get<TransactionsController>(TransactionsController);
    user = {
      id: 1,
      email: 'John@test.com',
      password: 'Doe',
      admin: true,
      status: UserStatus.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      keys: [],
      signerForTransactions: [],
      observableTransactions: [],
      approvableTransactions: [],
      comments: [],
      issuedNotifications: [],
      receivedNotifications: [],
      notificationPreferences: [],
    };
    transaction = {
      id: 1,
      name: 'Test transaction',
      type: TransactionType.ACCOUNT_CREATE,
      description: 'Test transaction description',
      transactionId: '0.0.123@15648433.112315',
      validStart: new Date(),
      transactionHash: '5a381df6a8s4f9e0asd8f46aw8e1f0asdd',
      transactionBytes: Buffer.from(
        '0x0a8b012a88010a83010a170a0b08a1b78ab20610c0c8e722120608001000187b180012060800100018021880c2d72f220308b401320274785a520a221220d3ef6b5fcf45025d011c18bea660cc0add0d35d4f6c9d4a24e70c4ceba49224b1080c0d590830130ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a0361636370008801011200',
      ),
      unsignedTransactionBytes: Buffer.from(
        '0x0a8b012a88010a83010a170a0b08a1b78ab20610c0c8e722120608001000187b180012060800100018021880c2d72f220308b401320274785a520a221220d3ef6b5fcf45025d011c18bea660cc0add0d35d4f6c9d4a24e70c4ceba49224b1080c0d590830130ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a0361636370008801011200',
      ),
      signature: Buffer.from(
        '0xfb228df4984c1d7bd0d6a915683350c2179f5436fc242d394a625f805c25061a50d9922448e88891a2dd6f9933f155c4b3a47195cfbf54a04597bd67ec27670f',
      ),
      status: TransactionStatus.NEW,
      network: Network.TESTNET,
      cutoffAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      creatorKey: {
        id: 1,
        publicKey: 'publicKey',
        mnemonicHash: 'mnemonicHash',
        index: 1,
        user: user,
        userId: user.id,
        deletedAt: null,
        createdTransactions: [],
        approvedTransactions: [],
        signedTransactions: [],
      },
      signers: [],
      approvers: [],
      observers: [],
      comments: [],
      groupItem: null,
    };
    pagination = {
      page: 1,
      limit: 10,
      size: 10,
      offset: 0,
    };
  });

  describe('createTransaction', () => {
    it('should return a transaction', async () => {
      const dto = { ...transaction, creatorKeyId: 1 };

      transactionService.createTransaction.mockResolvedValue(transaction);

      expect(await controller.createTransaction(dto, user)).toBe(transaction);
    });
  });

  describe('getTransactions', () => {
    it('should return an array of transactions', async () => {
      const result = {
        totalItems: 1,
        items: [transaction],
        page: 1,
        size: 10,
      };

      transactionService.getTransactions.mockResolvedValue(result);

      expect(await controller.getTransactions(user, pagination)).toBe(result);
    });

    it('should return an empty array if no transactions exist', async () => {
      const result = {
        totalItems: 0,
        items: [],
        page: 0,
        size: 0,
      };

      transactionService.getTransactions.mockResolvedValue(result);

      expect(await controller.getTransactions(user, pagination)).toEqual(result);
    });
  });

  describe('getHistoryTransactions', () => {
    it('should return an array of transactions', async () => {
      const result = {
        totalItems: 1,
        items: [transaction],
        page: 1,
        size: 10,
      };

      transactionService.getHistoryTransactions.mockResolvedValue(result);

      expect(await controller.getHistoryTransactions(pagination)).toBe(result);
    });

    it('should return an empty array if no transactions exist', async () => {
      const result = {
        totalItems: 0,
        items: [],
        page: 0,
        size: 0,
      };

      transactionService.getHistoryTransactions.mockResolvedValue(result);

      expect(await controller.getHistoryTransactions(pagination)).toEqual(result);
    });
  });

  describe('getTransactionsToSign', () => {
    it('should return an array of transactions', async () => {
      const result = {
        totalItems: 1,
        items: [
          {
            transaction,
            keysToSign: [1],
          },
        ],
        page: 1,
        size: 10,
      };

      transactionService.getTransactionsToSign.mockResolvedValue(result);

      expect(await controller.getTransactionsToSign(user, pagination)).toBe(result);
    });

    it('should return an empty array if no transactions exist', async () => {
      const result = {
        totalItems: 0,
        items: [],
        page: 0,
        size: 0,
      };

      transactionService.getTransactionsToSign.mockResolvedValue(result);

      expect(await controller.getTransactionsToSign(user, pagination)).toEqual(result);
    });
  });

  describe('shouldSignTransaction', () => {
    it('should return an array of key ids', async () => {
      const result = [1];

      transactionService.userKeysToSign.mockResolvedValue(result);

      expect(await controller.shouldSignTransaction(user, 1)).toBe(result);
    });
  });

  describe('getTransactionsToApprove', () => {
    it('should return an array of transactions', async () => {
      const result = {
        totalItems: 1,
        items: [transaction],
        page: 1,
        size: 10,
      };

      transactionService.getTransactionsToApprove.mockResolvedValue(result);

      expect(await controller.getTransactionsToApprove(user, pagination)).toBe(result);
    });

    it('should return an empty array if no transactions exist', async () => {
      const result = {
        totalItems: 0,
        items: [],
        page: 0,
        size: 0,
      };

      transactionService.getTransactionsToApprove.mockResolvedValue(result);

      expect(await controller.getTransactionsToApprove(user, pagination)).toEqual(result);
    });
  });

  describe('shouldApproveTransaction', () => {
    it('should return a boolean indicating if the user can approve the transaction', async () => {
      const result = false;

      transactionService.shouldApproveTransaction.mockResolvedValue(result);

      expect(await controller.shouldApproveTransaction(user, 1)).toBe(result);
    });
  });

  describe('deleteTransaction', () => {
    it('should return a boolean indicating if the transaction was deleted successfully', async () => {
      const result = true;

      transactionService.removeTransaction.mockResolvedValue(result);

      expect(await controller.deleteTransaction(user, 1)).toBe(result);
    });

    it('should throw an error if the transaction cannot be deleted', async () => {
      jest
        .spyOn(controller, 'deleteTransaction')
        .mockRejectedValue(new BadRequestException('Transaction not found'));

      await expect(controller.deleteTransaction(user, 1)).rejects.toThrowError(
        'Transaction not found',
      );
    });
  });

  describe('cancelTransaction', () => {
    it('should return a boolean indicating if the transaction has been canceled', async () => {
      const result = true;
      transactionService.cancelTransaction.mockResolvedValue(result);

      expect(await controller.cancelTransaction(user, 1)).toBe(result);
    });

    it('should return a boolean indicating if the transaction has not been canceled', async () => {
      jest
        .spyOn(controller, 'cancelTransaction')
        .mockRejectedValue(new BadRequestException('Transaction cannot be canceled'));

      await expect(controller.cancelTransaction(user, 1)).rejects.toThrowError(
        'Transaction cannot be canceled',
      );
    });
  });

  describe('getTransaction', () => {
    it('should return a transaction', async () => {
      transactionService.getTransactionWithVerifiedAccess.mockResolvedValue(transaction);

      expect(await controller.getTransaction(user, 1)).toBe(transaction);
    });
  });
});
