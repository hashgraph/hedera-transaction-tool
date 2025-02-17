import { ClientProxy } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mockDeep } from 'jest-mock-extended';
import { Repository } from 'typeorm';
import {
  AccountCreateTransaction,
  AccountUpdateTransaction,
  Client,
  FileUpdateTransaction,
  KeyList,
  Long,
  NodeUpdateTransaction,
  Transaction as SDKTransaction,
  Status,
  TransactionResponse,
} from '@hashgraph/sdk';

import {
  hasValidSignatureKey,
  computeSignatureKey,
  getClientFromNetwork,
  getStatusCodeFromMessage,
  MirrorNodeService,
  NOTIFICATIONS_SERVICE,
  notifyTransactionAction,
  transactionIs,
} from '@app/common';
import { Transaction, TransactionGroup, TransactionStatus } from '@entities';

import { ExecuteService } from './execute.service';

jest.mock('@app/common');
jest.mock('murlock', () => {
  const original = jest.requireActual('murlock');
  return {
    ...original,
    MurLock: function MurLock() {
      return (target, propertyKey, descriptor) => {
        return descriptor;
      };
    },
  };
});

describe('ExecuteService', () => {
  let service: ExecuteService;

  const transactionRepo = mockDeep<Repository<Transaction>>();
  const transactionGroupRepo = mockDeep<Repository<TransactionGroup>>();
  const notificationsService = mockDeep<ClientProxy>();
  const mirrorNodeService = mockDeep<MirrorNodeService>();

  const getExecutableTransaction = (
    baseTransaction: Partial<Transaction>,
  ): Partial<Transaction> => ({
    ...baseTransaction,
    transactionBytes: new AccountCreateTransaction().toBytes() as Buffer,
    status: TransactionStatus.WAITING_FOR_EXECUTION,
  });

  const getFileTransaction = (baseTransaction: Partial<Transaction>): Partial<Transaction> => ({
    ...baseTransaction,
    transactionBytes: new FileUpdateTransaction().toBytes() as Buffer,
  });

  const getAccountUpdateTransaction = (
    baseTransaction: Partial<Transaction>,
  ): Partial<Transaction> => ({
    ...baseTransaction,
    transactionBytes: new AccountUpdateTransaction().setAccountId('0.0.2').toBytes() as Buffer,
  });

  const getNodeUpdateTransaction = (
    baseTransaction: Partial<Transaction>,
  ): Partial<Transaction> => ({
    ...baseTransaction,
    transactionBytes: new NodeUpdateTransaction().setNodeId(Long.fromValue(2)).toBytes() as Buffer,
  });

  const getTransaction = (
    type: 'executable' | 'file' | 'account_update' | 'node_update',
  ): Partial<Transaction> => {
    const baseTransaction = {
      id: 1,
      signers: [],
      approvers: [],
      observers: [],
      creatorKey: null,
      mirrorNetwork: 'testnet',
      validStart: new Date(),
    };

    switch (type) {
      case 'executable':
        return getExecutableTransaction(baseTransaction);
      case 'file':
        return getFileTransaction(baseTransaction);
      case 'account_update':
        return getAccountUpdateTransaction(baseTransaction);
      case 'node_update':
        return getNodeUpdateTransaction(baseTransaction);
    }
  };

  const mockSDKTransactionExecution = () => {
    const receipt = {
      toJSON: jest.fn(),
      toBytes: jest.fn(() => Buffer.from([])),
      status: {
        _code: 20,
      },
    };
    const response = {
      getReceipt: jest.fn(async () => {
        return receipt;
      }),
      toJSON: jest.fn(),
    };
    jest.spyOn(SDKTransaction.prototype, 'execute').mockImplementation(async () => {
      return response as unknown as TransactionResponse;
    });

    return { response, receipt };
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecuteService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepo,
        },
        {
          provide: NOTIFICATIONS_SERVICE,
          useValue: notificationsService,
        },
        {
          provide: MirrorNodeService,
          useValue: mirrorNodeService,
        },
      ],
    }).compile();

    service = module.get<ExecuteService>(ExecuteService);
  });

  describe('executeTransaction', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should execute a transaction', async () => {
      const client = mockDeep<Client>();
      const transaction = getTransaction('executable') as Transaction;

      transactionRepo.findOne.mockResolvedValueOnce(transaction);
      jest.mocked(computeSignatureKey).mockResolvedValueOnce(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      const { receipt, response } = mockSDKTransactionExecution();

      await service.executeTransaction(transaction);

      expect(response.getReceipt).toHaveBeenCalled();
      expect(transactionRepo.update).toHaveBeenCalledWith(
        { id: transaction.id },
        {
          executedAt: expect.any(Date),
          status: TransactionStatus.EXECUTED,
          statusCode: receipt.status._code,
        },
      );
      expect(client.close).toHaveBeenCalled();
    });

    it('should execute a transaction and save default code', async () => {
      const client = mockDeep<Client>();
      const transaction = getTransaction('executable') as Transaction;

      transactionRepo.findOne.mockResolvedValueOnce(transaction);
      jest.mocked(computeSignatureKey).mockResolvedValueOnce(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.spyOn(SDKTransaction.prototype, 'execute').mockImplementation(async () => {
        return {
          getReceipt: jest.fn(async () => {
            return {
              toJSON: jest.fn(),
              toBytes: jest.fn(() => Buffer.from([])),
              status: {},
            };
          }),
          toJSON: jest.fn(),
        } as unknown as TransactionResponse;
      });

      await service.executeTransaction(transaction);

      expect(transactionRepo.update).toHaveBeenCalledWith(
        { id: transaction.id },
        {
          executedAt: expect.any(Date),
          status: TransactionStatus.EXECUTED,
          statusCode: Status.Ok._code,
        },
      );
      expect(client.close).toHaveBeenCalled();
    });

    it('should update the transaction if execution fails without error status', async () => {
      const client = mockDeep<Client>();
      const transaction = getTransaction('executable') as Transaction;

      transactionRepo.findOne.mockResolvedValueOnce(transaction);
      jest.mocked(computeSignatureKey).mockResolvedValueOnce(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.spyOn(SDKTransaction.prototype, 'execute').mockRejectedValueOnce({
        message: 'Transaction failed',
      });
      jest.mocked(getStatusCodeFromMessage).mockReturnValueOnce(21);

      await service.executeTransaction(transaction);

      expect(transactionRepo.update).toHaveBeenCalledWith(
        { id: transaction.id },
        {
          executedAt: expect.any(Date),
          status: TransactionStatus.FAILED,
          statusCode: 21,
        },
      );
      expect(client.close).toHaveBeenCalled();
    });

    it('should update the transaction if execution fails with error status', async () => {
      const client = mockDeep<Client>();
      const transaction = getTransaction('executable') as Transaction;

      transactionRepo.findOne.mockResolvedValueOnce(transaction);
      jest.mocked(computeSignatureKey).mockResolvedValueOnce(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.spyOn(SDKTransaction.prototype, 'execute').mockRejectedValueOnce({
        message: 'Transaction failed',
        status: {
          _code: 21,
        },
      });

      await service.executeTransaction(transaction);

      expect(transactionRepo.update).toHaveBeenCalledWith(
        { id: transaction.id },
        {
          executedAt: expect.any(Date),
          status: TransactionStatus.FAILED,
          statusCode: 21,
        },
      );
      expect(client.close).toHaveBeenCalled();
      expect(notifyTransactionAction).toHaveBeenCalled();
    });

    it('should update the account info if the transaction is account update', async () => {
      const client = mockDeep<Client>();
      const transaction = getTransaction('account_update') as Transaction;

      transactionRepo.findOne.mockResolvedValueOnce(transaction);
      jest.mocked(computeSignatureKey).mockResolvedValueOnce(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.mocked(transactionIs).mockReturnValueOnce(true);

      jest.useFakeTimers();

      await service.executeTransaction(transaction);

      jest.runAllTimers();
      jest.useRealTimers();

      expect(mirrorNodeService.updateAccountInfo).toHaveBeenCalled();
    });

    it('should handle errors when updating account info', async () => {
      const client = mockDeep<Client>();
      const transaction = getTransaction('account_update') as Transaction;

      transactionRepo.findOne.mockResolvedValueOnce(transaction);
      jest.mocked(computeSignatureKey).mockResolvedValueOnce(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.mocked(transactionIs).mockReturnValueOnce(true);
      mirrorNodeService.updateAccountInfo.mockRejectedValueOnce(
        new Error('Failed to update account info'),
      );
      jest.useFakeTimers();

      await service.executeTransaction(transaction);

      await jest.advanceTimersToNextTimerAsync();
      jest.useRealTimers();

      expect(mirrorNodeService.updateAccountInfo).toHaveBeenCalled();
    });

    it('should update the node info if the transaction is node update', async () => {
      const client = mockDeep<Client>();
      const transaction = getTransaction('node_update') as Transaction;

      transactionRepo.findOne.mockResolvedValueOnce(transaction);
      jest.mocked(computeSignatureKey).mockResolvedValueOnce(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.mocked(transactionIs).mockReturnValueOnce(false);
      jest.mocked(transactionIs).mockReturnValueOnce(true);

      jest.useFakeTimers();

      await service.executeTransaction(transaction);

      jest.runAllTimers();
      jest.useRealTimers();

      expect(mirrorNodeService.updateNodeInfo).toHaveBeenCalled();
    });

    it('should handle errors when updating node info', async () => {
      const client = mockDeep<Client>();
      const transaction = getTransaction('node_update') as Transaction;

      transactionRepo.findOne.mockResolvedValueOnce(transaction);
      jest.mocked(computeSignatureKey).mockResolvedValueOnce(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.mocked(transactionIs).mockReturnValueOnce(false);
      jest.mocked(transactionIs).mockReturnValueOnce(true);
      mirrorNodeService.updateNodeInfo.mockRejectedValueOnce(
        new Error('Failed to update node info'),
      );
      jest.useFakeTimers();

      await service.executeTransaction(transaction);

      await jest.advanceTimersToNextTimerAsync();
      jest.useRealTimers();

      expect(mirrorNodeService.updateNodeInfo).toHaveBeenCalled();
    });

    it('should throw on invalid signature', async () => {
      const transaction = getTransaction('executable') as Transaction;

      transactionRepo.findOne.mockResolvedValueOnce(transaction);
      jest.mocked(computeSignatureKey).mockResolvedValueOnce(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(false);

      await expect(service.executeTransaction(transaction)).rejects.toThrow(
        'Transaction has invalid signature.',
      );
    });

    it('should throw on transaction invalid statuses', async () => {
      const transaction = getTransaction('executable') as Transaction;

      transaction.status = TransactionStatus.NEW;
      transactionRepo.findOne.mockResolvedValueOnce(transaction);

      await expect(service.executeTransaction(transaction)).rejects.toThrow(
        'Transaction is new and has not been signed yet.',
      );

      transaction.status = TransactionStatus.FAILED;
      transactionRepo.findOne.mockResolvedValueOnce(transaction);

      await expect(service.executeTransaction(transaction)).rejects.toThrow(
        'Transaction has already been executed, but failed.',
      );

      transaction.status = TransactionStatus.EXECUTED;
      transactionRepo.findOne.mockResolvedValueOnce(transaction);

      await expect(service.executeTransaction(transaction)).rejects.toThrow(
        'Transaction has already been executed.',
      );

      transaction.status = TransactionStatus.REJECTED;
      transactionRepo.findOne.mockResolvedValueOnce(transaction);

      await expect(service.executeTransaction(transaction)).rejects.toThrow(
        'Transaction has already been rejected.',
      );

      transaction.status = TransactionStatus.EXPIRED;
      transactionRepo.findOne.mockResolvedValueOnce(transaction);

      await expect(service.executeTransaction(transaction)).rejects.toThrow(
        'Transaction has been expired.',
      );

      transaction.status = TransactionStatus.CANCELED;
      transactionRepo.findOne.mockResolvedValueOnce(transaction);

      await expect(service.executeTransaction(transaction)).rejects.toThrow(
        'Transaction has been canceled.',
      );

      transaction.status = TransactionStatus.ARCHIVED;
      transactionRepo.findOne.mockResolvedValueOnce(transaction);

      await expect(service.executeTransaction(transaction)).rejects.toThrow(
        'Transaction is archived.',
      );

      transaction.isManual = false;
    });

    it('should throw if transaction is null or undefined', async () => {
      transactionRepo.findOne.mockResolvedValueOnce(undefined);

      await expect(service.executeTransaction(null)).rejects.toThrow('Transaction not found');
      await expect(service.executeTransaction(undefined)).rejects.toThrow('Transaction not found');
    });
  });

  describe('executeTransactionGroup', () => {
    let client: Client;
    let transaction: Transaction;
    let transactionGroup: TransactionGroup;

    beforeEach(() => {
      jest.restoreAllMocks();
      jest.resetAllMocks();

      client = mockDeep<Client>();
      transactionGroup = {
        id: 1,
        description: '',
        atomic: false,
        sequential: false,
        createdAt: new Date(),
        groupItems: [],
      };

      for (let i = 0; i < 3; i++) {
        transaction = getTransaction('executable') as Transaction;
        transaction.id = i;

        transactionGroup.groupItems.push({
          groupId: 1,
          group: transactionGroup,
          seq: 1,
          transactionId: transaction.id,
          transaction,
        });
      }
      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValue(true);
      jest.mocked(getClientFromNetwork).mockResolvedValue(client);
    });

    it('should execute a group of transactions sequentially', async () => {
      const { receipt, response } = mockSDKTransactionExecution();

      transactionGroup.sequential = true;
      transactionGroupRepo.findOne.mockResolvedValueOnce(transactionGroup);
      transactionRepo.findOne.mockResolvedValue({
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      } as Transaction);

      await service.executeTransactionGroup(transactionGroup);

      expect(response.getReceipt).toHaveBeenCalled();
      transactionGroup.groupItems.forEach(groupItem => {
        expect(transactionRepo.update).toHaveBeenCalledWith(
          { id: groupItem.transaction.id },
          {
            executedAt: expect.any(Date),
            status: TransactionStatus.EXECUTED,
            statusCode: receipt.status._code,
          },
        );
      });
      expect(client.close).toHaveBeenCalled();
    });

    it('should fail to execute full group of transactions sequentially if one fails', async () => {
      const { receipt, response } = mockSDKTransactionExecution();

      transactionGroup.sequential = true;
      transactionGroupRepo.findOne.mockResolvedValueOnce(transactionGroup);
      transactionRepo.findOne.mockResolvedValue({
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      } as Transaction);

      await service.executeTransactionGroup(transactionGroup);

      expect(response.getReceipt).toHaveBeenCalled();
      expect(transactionRepo.update).toHaveBeenCalledWith(
        { id: transaction.id },
        {
          executedAt: expect.any(Date),
          status: TransactionStatus.EXECUTED,
          statusCode: receipt.status._code,
        },
      );
      expect(client.close).toHaveBeenCalled();
    });

    it('should execute a group of transactions in parallel', async () => {
      const { receipt, response } = mockSDKTransactionExecution();

      transactionGroupRepo.findOne.mockResolvedValueOnce(transactionGroup);
      transactionRepo.findOne.mockResolvedValue({
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      } as Transaction);

      await service.executeTransactionGroup(transactionGroup);

      expect(response.getReceipt).toHaveBeenCalled();
      expect(transactionRepo.update).toHaveBeenCalledWith(
        { id: transaction.id },
        {
          executedAt: expect.any(Date),
          status: TransactionStatus.EXECUTED,
          statusCode: receipt.status._code,
        },
      );
      expect(client.close).toHaveBeenCalled();
    });

    it('should handle errors in a group of transactions', async () => {
      jest.spyOn(SDKTransaction.prototype, 'execute').mockRejectedValue({
        message: 'Transaction failed',
        status: {
          _code: 21,
        },
      });

      transactionGroupRepo.findOne.mockResolvedValueOnce(transactionGroup);
      transactionRepo.findOne.mockResolvedValue({
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      } as Transaction);

      await service.executeTransactionGroup(transactionGroup);

      transactionGroup.groupItems.forEach(groupItem => {
        expect(transactionRepo.update).toHaveBeenCalledWith(
          { id: groupItem.transaction.id },
          {
            executedAt: expect.any(Date),
            status: TransactionStatus.FAILED,
            statusCode: 21,
          },
        );
      });
      expect(client.close).toHaveBeenCalled();
      expect(notifyTransactionAction).toHaveBeenCalled();
    });

    it('should throw error if failed to get validated transaction from the group', async () => {
      const errorMessage = 'Transaction not found';
      jest
        // @ts-expect-error private function
        .spyOn(service, 'getValidatedSDKTransaction')
        // @ts-expect-error private function
        .mockRejectedValueOnce(new Error(errorMessage));

      transactionGroupRepo.findOne.mockResolvedValueOnce(transactionGroup);

      await expect(service.executeTransactionGroup(transactionGroup)).rejects.toThrow(
        `Transaction Group cannot be submitted. Error validating transaction 0: ${errorMessage}`,
      );
    });

    it('should execute all transactions except the canceled', async () => {
      const { receipt, response } = mockSDKTransactionExecution();

      transactionGroup.groupItems[0].transaction.status = TransactionStatus.CANCELED;

      transactionGroupRepo.findOne.mockResolvedValueOnce(transactionGroup);
      transactionRepo.findOne.mockResolvedValue({
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      } as Transaction);

      await service.executeTransactionGroup(transactionGroup);

      expect(response.getReceipt).toHaveBeenCalled();

      transactionGroup.groupItems.forEach(groupItem => {
        if (groupItem.transaction.status === TransactionStatus.CANCELED) {
          expect(transactionRepo.update).not.toHaveBeenCalledWith(
            { id: groupItem.transaction.id },
            expect.anything(),
          );
        } else {
          expect(transactionRepo.update).toHaveBeenCalledWith(
            { id: groupItem.transaction.id },
            {
              executedAt: expect.any(Date),
              status: TransactionStatus.EXECUTED,
              statusCode: receipt.status._code,
            },
          );
        }
      });

      expect(client.close).toHaveBeenCalled();
    });

    it('should not execute any transactions if all transactions are canceled', async () => {
      transactionGroup.groupItems.forEach(groupItem => {
        groupItem.transaction.status = TransactionStatus.CANCELED;
      });

      transactionGroupRepo.findOne.mockResolvedValueOnce(transactionGroup);
      transactionRepo.findOne.mockResolvedValue({
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      } as Transaction);

      const result = await service.executeTransactionGroup(transactionGroup);

      expect(result.transactions).toEqual([]);

      transactionGroup.groupItems.forEach(groupItem => {
        expect(transactionRepo.update).not.toHaveBeenCalledWith(
          { id: groupItem.transaction.id },
          expect.anything(),
        );
      });
    });
  });
});
