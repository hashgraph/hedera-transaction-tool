import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { SchedulerRegistry } from '@nestjs/schedule';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mockDeep } from 'jest-mock-extended';
import { Repository } from 'typeorm';

import {
  hasValidSignatureKey,
  computeSignatureKey,
  MirrorNodeService,
  NOTIFICATIONS_SERVICE,
  NOTIFY_GENERAL,
  smartCollate,
  notifySyncIndicators,
  notifyTransactionAction,
  notifyWaitingForSignatures,
  getNetwork,
} from '@app/common';
import {
  NotificationType,
  Transaction,
  TransactionGroup,
  TransactionGroupItem,
  TransactionStatus,
} from '@entities';

import { TransactionStatusService } from './transaction-status.service';
import { ExecuteService } from '../execute/execute.service';
import {
  AccountCreateTransaction,
  AccountId,
  KeyList,
  PrivateKey,
  TransactionId,
  Transaction as SDKTransaction,
  Timestamp,
  Status,
} from '@hashgraph/sdk';

jest.mock('@app/common');
jest.mock('@nestjs/schedule', () => {
  const original = jest.requireActual('@nestjs/schedule');
  return {
    ...original,
    Cron: function Cron() {
      return (target, propertyKey, descriptor) => {
        return descriptor;
      };
    },
    CronExpression: function CronExpression() {
      return (target, propertyKey, descriptor) => {
        return descriptor;
      };
    },
  };
});

const expectNotifyNotCalled = () => {
  expect(notifyTransactionAction).not.toHaveBeenCalled();
  expect(notifySyncIndicators).not.toHaveBeenCalled();
};

describe('TransactionStatusService', () => {
  let service: TransactionStatusService;

  const transactionRepo = mockDeep<Repository<Transaction>>();
  const transactionGroupRepo = mockDeep<Repository<TransactionGroup>>();
  const notificationsService = mockDeep<ClientProxy>();
  const schedulerRegistry = mockDeep<SchedulerRegistry>();
  const executeService = mockDeep<ExecuteService>();
  const mirrorNodeService = mockDeep<MirrorNodeService>();

  const mockTransaction = () => {
    const transactionMock = jest.fn(async passedFunction => {
      await passedFunction(transactionRepo.manager);
    });
    transactionRepo.manager.transaction.mockImplementation(transactionMock);
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionStatusService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepo,
        },
        {
          provide: getRepositoryToken(TransactionGroup),
          useValue: transactionGroupRepo,
        },
        {
          provide: NOTIFICATIONS_SERVICE,
          useValue: notificationsService,
        },
        {
          provide: SchedulerRegistry,
          useValue: schedulerRegistry,
        },
        {
          provide: ExecuteService,
          useValue: executeService,
        },
        {
          provide: MirrorNodeService,
          useValue: mirrorNodeService,
        },
      ],
    }).compile();

    service = module.get<TransactionStatusService>(TransactionStatusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should request update for transactions that have started in initial cron', async () => {
    const transactions = [];
    transactionRepo.find.mockResolvedValue(transactions);

    jest.spyOn(service, 'updateTransactions');
    jest.spyOn(service, 'getValidStartNowMinus180Seconds');

    await service.handleInitialTransactionStatusUpdate();

    expect(service.updateTransactions).toHaveBeenCalled();
    expect(service.getValidStartNowMinus180Seconds).toHaveBeenCalled();
  });

  it('should call prepareAndExecute for transactions that are waiting for execution in initial cron', async () => {
    const transactions = [
      {
        validStart: new Date(new Date().getTime() - 10 * 1_000),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      },
    ];

    jest.spyOn(service, 'updateTransactions').mockResolvedValueOnce(transactions as Transaction[]);
    jest.spyOn(service, 'getValidStartNowMinus180Seconds').mockImplementationOnce(jest.fn());
    jest.spyOn(service, 'prepareTransactions').mockImplementationOnce(jest.fn());

    await service.handleInitialTransactionStatusUpdate();

    expect(service.prepareTransactions).toHaveBeenCalled();
  });

  it('should request update for transactions with valid start after one week', async () => {
    const transactions = [];
    transactionRepo.find.mockResolvedValue(transactions);

    jest.spyOn(service, 'updateTransactions');
    jest.spyOn(service, 'getOneWeekLater');

    await service.handleTransactionsAfterOneWeek();

    expect(service.updateTransactions).toHaveBeenCalled();
    expect(service.getOneWeekLater).toHaveBeenCalled();
  });

  it('should request update for transactions with valid start between one day and one week later', async () => {
    const transactions = [];
    transactionRepo.find.mockResolvedValue(transactions);

    jest.spyOn(service, 'updateTransactions');
    jest.spyOn(service, 'getOneDayLater');
    jest.spyOn(service, 'getOneWeekLater');

    await service.handleTransactionsBetweenOneDayAndOneWeek();

    expect(service.updateTransactions).toHaveBeenCalled();
    expect(service.getOneDayLater).toHaveBeenCalled();
    expect(service.getOneWeekLater).toHaveBeenCalled();
  });

  it('should request update for transactions with valid start between one hour and one day later', async () => {
    const transactions = [];
    transactionRepo.find.mockResolvedValue(transactions);

    jest.spyOn(service, 'updateTransactions');
    jest.spyOn(service, 'getOneHourLater');
    jest.spyOn(service, 'getOneDayLater');

    await service.handleTransactionsBetweenOneHourAndOneDay();

    expect(service.updateTransactions).toHaveBeenCalled();
    expect(service.getOneHourLater).toHaveBeenCalled();
    expect(service.getOneDayLater).toHaveBeenCalled();
  });

  it('should request update for transactions with valid start between ten minutes and one hour later', async () => {
    const transactions = [];
    transactionRepo.find.mockResolvedValue(transactions);

    jest.spyOn(service, 'updateTransactions');
    jest.spyOn(service, 'getOneHourLater');
    jest.spyOn(service, 'getTenMinutesLater');

    await service.handleTransactionsBetweenTenMinutesAndOneHour();

    expect(service.updateTransactions).toHaveBeenCalled();
    expect(service.getOneHourLater).toHaveBeenCalled();
    expect(service.getTenMinutesLater).toHaveBeenCalled();
  });

  it('should request update for transactions with valid start between three minutes and ten minutes later', async () => {
    const transactions = [];
    transactionRepo.find.mockResolvedValue(transactions);

    jest.spyOn(service, 'updateTransactions');
    jest.spyOn(service, 'getThreeMinutesLater');
    jest.spyOn(service, 'getTenMinutesLater');

    await service.handleTransactionsBetweenThreeMinutesAndTenMinutes();

    expect(service.updateTransactions).toHaveBeenCalled();
    expect(service.getThreeMinutesLater).toHaveBeenCalled();
    expect(service.getTenMinutesLater).toHaveBeenCalled();
  });

  it('should request update for transactions with valid start between now and three minutes later', async () => {
    const transactions = [];
    transactionRepo.find.mockResolvedValue(transactions);

    jest.spyOn(service, 'updateTransactions');
    jest.spyOn(service, 'getValidStartNowMinus180Seconds');
    jest.spyOn(service, 'getThreeMinutesLater');

    await service.handleTransactionsBetweenNowAndAfterThreeMinutes();

    expect(service.updateTransactions).toHaveBeenCalled();
    expect(service.getValidStartNowMinus180Seconds).toHaveBeenCalled();
    expect(service.getThreeMinutesLater).toHaveBeenCalled();
  });

  it('should add execution timeout for transactions that are now ready for execution, ', async () => {
    const transactions = [
      {
        validStart: new Date(new Date().getTime() - 10 * 1_000),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      },
    ];

    jest.spyOn(service, 'updateTransactions').mockResolvedValueOnce(transactions as Transaction[]);
    jest.spyOn(service, 'getValidStartNowMinus180Seconds').mockImplementationOnce(jest.fn());
    jest.spyOn(service, 'prepareTransactions').mockImplementationOnce(jest.fn());

    await service.handleTransactionsBetweenNowAndAfterThreeMinutes();

    expect(service.prepareTransactions).toHaveBeenCalled();
  });

  it('should updates for expired transactions', async () => {
    mockTransaction();

    const expiredTransactions = [
      { id: 1, status: TransactionStatus.NEW, mirrorNetwork: 'testnet' },
      { id: 2, status: TransactionStatus.REJECTED, mirrorNetwork: 'testnet' },
      { id: 3, status: TransactionStatus.WAITING_FOR_EXECUTION, mirrorNetwork: 'testnet' },
    ];

    transactionRepo.manager.find.mockResolvedValue(expiredTransactions as Transaction[]);

    await service.handleExpiredTransactions();

    expect(transactionRepo.manager.transaction).toHaveBeenCalled();
    expect(transactionRepo.manager.update).toHaveBeenCalled();

    for (const transaction of expiredTransactions) {
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        TransactionStatus.EXPIRED,
        transaction.mirrorNetwork,
      );
    }
    expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
    expect(notifySyncIndicators).toHaveBeenCalledTimes(3);
  });

  describe('updateTransactions', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should correctly update transactions statuses', async () => {
      const transactions = [
        {
          id: 1,
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          transactionBytes: new AccountCreateTransaction().toBytes(),
          transactionId: '0.0.1',
          creatorKey: {
            userId: 23,
          },
          mirrorNetwork: 'testnet',
        },
        {
          id: 2,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          transactionBytes: new AccountCreateTransaction().toBytes(),
          transactionId: '0.0.2',
          creatorKey: {
            userId: 24,
          },
          mirrorNetwork: 'testnet',
        },
      ];

      transactionRepo.find.mockResolvedValue(transactions as Transaction[]);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(false);

      await service.updateTransactions(new Date(), new Date());

      const networkString = getNetwork(transactions[0] as Transaction);

      expect(transactionRepo.update).toHaveBeenNthCalledWith(
        1,
        {
          id: transactions[0].id,
        },
        {
          status: TransactionStatus.WAITING_FOR_EXECUTION,
        },
      );
      expect(transactionRepo.update).toHaveBeenNthCalledWith(
        2,
        {
          id: transactions[1].id,
        },
        {
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
        },
      );

      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transactions[0].id,
        TransactionStatus.WAITING_FOR_EXECUTION,
        transactions[0].mirrorNetwork,
      );
      expect(notificationsService.emit).toHaveBeenCalledWith(NOTIFY_GENERAL, {
        entityId: transactions[0].id,
        type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
        actorId: null,
        content: `Transaction is ready for execution!\nTransaction ID: ${transactions[0].transactionId}\nNetwork: ${networkString}`,
        userIds: [transactions[0].creatorKey?.userId],
        additionalData: { network: transactions[0].mirrorNetwork },
      });
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transactions[1].id,
        TransactionStatus.WAITING_FOR_SIGNATURES,
        transactions[1].mirrorNetwork,
      );
      expect(notifyWaitingForSignatures).toHaveBeenCalledWith(
        notificationsService,
        transactions[1].id,
        transactions[1].mirrorNetwork,
      );
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
      expect(notifyTransactionAction).toHaveBeenCalledTimes(1);
    });

    it('should not emit notifications event if no transactions updated', async () => {
      const transactions = [
        {
          id: 1,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          transactionBytes: new AccountCreateTransaction().toBytes(),
        },
        {
          id: 2,
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          transactionBytes: new AccountCreateTransaction().toBytes(),
        },
        {
          id: 3,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          transactionBytes: new AccountCreateTransaction().toBytes(),
        },
      ];

      transactionRepo.find.mockResolvedValue(transactions as Transaction[]);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(false);
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(false);
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);
      jest.spyOn(transactionRepo, 'update').mockRejectedValueOnce('Error');

      await service.updateTransactions(new Date(), new Date());

      expectNotifyNotCalled();
    });
  });

  describe('updateTransactionStatus', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should correctly update transactions status', async () => {
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        transactionBytes: new AccountCreateTransaction().toBytes(),
        transactionId: '0.0.1',
        creatorKey: {
          userId: 23,
        },
        mirrorNetwork: 'testnet',
      };
      transactionRepo.findOne.mockResolvedValue(transaction as Transaction);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);

      await service.updateTransactionStatus({ id: transaction.id });

      const networkString = getNetwork(transaction as Transaction);

      expect(transactionRepo.update).toHaveBeenNthCalledWith(
        1,
        {
          id: 1,
        },
        {
          status: TransactionStatus.WAITING_FOR_EXECUTION,
        },
      );
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        TransactionStatus.WAITING_FOR_EXECUTION,
        transaction.mirrorNetwork,
      );
      expect(notificationsService.emit).toHaveBeenCalledWith(NOTIFY_GENERAL, {
        entityId: transaction.id,
        type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
        actorId: null,
        content: `Transaction is ready for execution!\nTransaction ID: ${transaction.transactionId}\nNetwork: ${networkString}`,
        userIds: [transaction.creatorKey?.userId],
        additionalData: { network: transaction.mirrorNetwork },
      });
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
    });

    it('should not emit notifications event if no transactions updated', async () => {
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        transactionBytes: new AccountCreateTransaction().toBytes(),
      };

      transactionRepo.findOne.mockResolvedValue(transaction as Transaction);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(false);
      jest.mocked(smartCollate).mockReturnValueOnce(null);
      jest.spyOn(transactionRepo, 'update').mockRejectedValueOnce(new Error('Error'));

      await expect(service.updateTransactionStatus({ id: transaction.id })).rejects.toThrow(
        'Error',
      );

      expectNotifyNotCalled();
    });

    it('should return if transaction does not exist', async () => {
      transactionRepo.findOne.mockResolvedValue(undefined);

      await service.updateTransactionStatus({ id: 1 });

      expect(transactionRepo.findOne).toHaveBeenCalled();
      expect(transactionRepo.update).not.toHaveBeenCalled();
      expectNotifyNotCalled();
    });

    it('should return if transaction status is the same', async () => {
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        transactionBytes: new AccountCreateTransaction().toBytes(),
      };
      transactionRepo.findOne.mockResolvedValue(transaction as Transaction);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);

      await service.updateTransactionStatus({ id: transaction.id });

      expect(transactionRepo.findOne).toHaveBeenCalled();
      expect(transactionRepo.update).not.toHaveBeenCalled();
      expectNotifyNotCalled();
    });
  });

  describe('prepareTransactions', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
    });

    it('should call collateAndExecute for each transaction with status WAITING_FOR_EXECUTION', async () => {
      const transactions = [
        {
          id: 1,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          validStart: new Date(),
        } as Transaction,
        {
          id: 2,
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          validStart: new Date(),
        } as Transaction,
        {
          id: 3,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          validStart: new Date(),
        } as Transaction,
      ];

      jest.spyOn(service, 'collateAndExecute').mockImplementation(jest.fn());
      jest.spyOn(service, 'isValidStartExecutable').mockImplementation(() => true);

      await service.prepareTransactions(transactions);

      expect(service.collateAndExecute).toHaveBeenCalledTimes(2);
      expect(service.collateAndExecute).toHaveBeenCalledWith(transactions[0]);
      expect(service.collateAndExecute).toHaveBeenCalledWith(transactions[2]);
    });

    it('should not call collateAndExecute for transactions with status other than WAITING_FOR_EXECUTION', async () => {
      const transactions = [
        { id: 1, status: TransactionStatus.WAITING_FOR_SIGNATURES } as Transaction,
        { id: 2, status: TransactionStatus.NEW } as Transaction,
      ];

      jest.spyOn(service, 'collateAndExecute').mockImplementation(jest.fn());

      await service.prepareTransactions(transactions);

      expect(service.collateAndExecute).not.toHaveBeenCalled();
    });

    it('should call collateGroupAndExecute for each transaction group with status WAITING_FOR_EXECUTION', async () => {
      const transactionGroups = [
        {
          id: 1,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          validStart: new Date(),
          groupItem: {
            groupId: 1,
          },
        } as Transaction,
        {
          id: 2,
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          validStart: new Date(),
        } as Transaction,
        {
          id: 3,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          validStart: new Date(),
          groupItem: {
            groupId: 2,
          },
        } as Transaction,
      ];

      jest.spyOn(service, 'collateGroupAndExecute').mockImplementation(jest.fn());
      jest.spyOn(service, 'isValidStartExecutable').mockImplementation(() => true);

      await service.prepareTransactions(transactionGroups);

      expect(service.collateGroupAndExecute).toHaveBeenCalledTimes(2);
    });

    it('should not call collateGroupAndExecute for transaction groups with status other than WAITING_FOR_EXECUTION', async () => {
      const transactionGroups = [
        {
          id: 1,
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          groupItem: {
            groupId: 1,
          },
        } as Transaction,
        {
          id: 2,
          status: TransactionStatus.NEW,
          groupItem: {
            groupId: 2,
          },
        } as Transaction,
      ];

      jest.spyOn(service, 'collateGroupAndExecute').mockImplementation(jest.fn());
      jest.spyOn(service, 'isValidStartExecutable').mockImplementation(() => true);

      await service.prepareTransactions(transactionGroups);

      expect(service.collateGroupAndExecute).not.toHaveBeenCalled();
    });

    it('should not call collateGroupAndExecute more than once for a group', async () => {
      const transactionGroups = [
        {
          id: 1,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          validStart: new Date(),
          groupItem: {
            groupId: 1,
          },
        } as Transaction,
        {
          id: 3,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          validStart: new Date(),
          groupItem: {
            groupId: 1,
          },
        } as Transaction,
      ];

      jest.spyOn(service, 'collateGroupAndExecute').mockImplementation(jest.fn());
      jest.spyOn(service, 'isValidStartExecutable').mockImplementation(() => true);

      await service.prepareTransactions(transactionGroups);

      expect(service.collateGroupAndExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('collateGroupAndExecute', () => {
    const transactions: SDKTransaction[] = [];
    let mockTransactionGroup: TransactionGroup;
    let name: string;
    let timeToValidStart: number;

    beforeEach(async () => {
      jest.setTimeout(10_000);
      jest.resetAllMocks();
      const validStart = new Date(Date.now());
      for (let i = 0; i < 10; i++) {
        const transaction = new AccountCreateTransaction()
          .setNodeAccountIds([new AccountId(3)])
          .setTransactionId(
            TransactionId.withValidStart(
              new AccountId(3),
              Timestamp.fromDate(new Date(validStart.getTime() + i * 1000)),
            ),
          )
          .setTransactionMemo('Test Transaction')
          .freeze();
        transactions.push(transaction);
      }
      mockTransactionGroup = {
        id: 1,
        description: 'Test Group',
        atomic: false,
        sequential: true,
        createdAt: new Date(),
        groupItems: [],
      } as TransactionGroup;
      for (let i = 0; i < 10; i++) {
        const mockTransaction = {
          id: i,
          validStart: new Date(validStart.getTime() + i * 1000),
          status: TransactionStatus.WAITING_FOR_EXECUTION,
        } as Transaction;
        mockTransactionGroup.groupItems.push({
          groupId: 1,
          seq: i,
          transaction: mockTransaction,
        } as TransactionGroupItem);
      }
      name = `smart_collate_group_timeout_${mockTransactionGroup.id}`;

      timeToValidStart =
        mockTransactionGroup.groupItems[0].transaction.validStart.getTime() - Date.now();

      jest.useFakeTimers();
      jest.spyOn(global, 'setTimeout');
      jest.spyOn(schedulerRegistry, 'doesExist').mockReturnValue(false);
      jest.spyOn(schedulerRegistry, 'addTimeout');
      jest.spyOn(schedulerRegistry, 'deleteTimeout');
      jest.spyOn(executeService, 'executeTransaction').mockResolvedValue(undefined);
      jest.spyOn(service, 'addGroupExecutionTimeout').mockImplementationOnce(jest.fn());
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should not set a timeout if one already exists', () => {
      schedulerRegistry.doesExist.mockReturnValueOnce(true);

      service.collateGroupAndExecute(mockTransactionGroup);

      expect(setTimeout).not.toHaveBeenCalled();
    });

    it('should set a timeout with the correct delay', () => {
      service.collateGroupAndExecute(mockTransactionGroup);

      expect(setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        expect.closeTo(timeToValidStart - 10 * 1000),
      );
    });

    it('should add the timeout to the scheduler registry', () => {
      service.collateGroupAndExecute(mockTransactionGroup);

      expect(schedulerRegistry.addTimeout).toHaveBeenCalledWith(name, expect.anything());
    });

    it('should collate and execute a transaction group signed with 10 different keys, reducing the signatures as needed', async () => {
      // prepare the signatures
      const keyList = new KeyList();
      const privateKeys = [];

      for (let i = 0; i < 10; i++) {
        let transaction = transactions[i];
        for (let j = 0; j < 10; j++) {
          const privateKey = PrivateKey.generate();
          privateKeys.push(privateKey);
          keyList.push(privateKey.publicKey);
          transaction = await transaction.sign(privateKey);
        }
        mockTransactionGroup.groupItems[i].transaction.transactionBytes = Buffer.from(
          transaction.toBytes(),
        );

        transaction.removeAllSignatures();
      }

      // Mock the functions
      jest.mocked(smartCollate).mockImplementation(async transaction => {
        for (let i = 0; i < 10; i++) {
          const _transaction = mockTransactionGroup.groupItems[i].transaction;

          if (_transaction.id === transaction.id) {
            privateKeys.slice(0, 5).forEach(key => transactions[i].sign(key));
            return transactions[i];
          }
        }
        return null;
      });
      jest.mocked(computeSignatureKey).mockResolvedValue(keyList);

      service.collateGroupAndExecute(mockTransactionGroup);

      await jest.advanceTimersToNextTimerAsync();

      expect(service.addGroupExecutionTimeout).toHaveBeenCalled();

      mockTransactionGroup.groupItems.forEach(groupItem => {
        const sdkTransaction = SDKTransaction.fromBytes(groupItem.transaction.transactionBytes);

        expect(sdkTransaction._signerPublicKeys.size).toBe(5);
      });
    }, 15000);

    it('should fail to prepare a group of signed transactions, due to key list unable to be sufficiently reduced', async () => {
      const keyList = new KeyList();
      const privateKeys = [];

      for (let i = 0; i < 10; i++) {
        let transaction = transactions[i];
        const privateKey = PrivateKey.generate();
        privateKeys.push(privateKey);
        keyList.push(privateKey.publicKey);
        transaction = await transaction.sign(privateKey);
        mockTransactionGroup.groupItems[i].transaction.transactionBytes = Buffer.from(
          transaction.toBytes(),
        );

        transaction.removeAllSignatures();
      }

      // Mock the functions
      jest.mocked(smartCollate).mockReturnValue(null);
      jest.mocked(computeSignatureKey).mockResolvedValue(keyList);

      jest.spyOn(transactionRepo, 'update').mockResolvedValue(undefined);

      service.collateGroupAndExecute(mockTransactionGroup);

      await jest.advanceTimersToNextTimerAsync();

      expect(service.addGroupExecutionTimeout).not.toHaveBeenCalled();

      mockTransactionGroup.groupItems.forEach(groupItem => {
        // Verify that the update method was called with the correct parameters
        expect(transactionRepo.update).toHaveBeenCalledWith(
          { id: groupItem.transaction.id },
          {
            status: TransactionStatus.FAILED,
            executedAt: expect.any(Date),
            statusCode: Status.TransactionOversize._code,
          },
        );
      });
    });

    it('should fail to prepare a group of signed transactions, due to some transactions not signed', async () => {
      const notSignedIndex = 9;
      mockTransactionGroup.groupItems[notSignedIndex].transaction.status =
        TransactionStatus.WAITING_FOR_SIGNATURES;
      jest.mocked(smartCollate).mockImplementation(async transaction => {
        for (let i = 0; i < 10; i++) {
          const _transaction = mockTransactionGroup.groupItems[i].transaction;

          if (_transaction.id === transaction.id && i !== notSignedIndex) {
            return transactions[i];
          }
        }
        return null;
      });

      service.collateGroupAndExecute(mockTransactionGroup);

      await jest.advanceTimersToNextTimerAsync();

      expect(service.addGroupExecutionTimeout).not.toHaveBeenCalled();
      expect(transactionRepo.update).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          executedAt: expect.any(Date),
          statusCode: Status.TransactionOversize._code,
        }),
      );
    });

    it('should fail to prepare a group of signed transactions, due to some transactions not able to pass smart collating', async () => {
      // prepare the signatures
      const keyList = new KeyList();
      const privateKeys = [];

      for (let i = 0; i < 9; i++) {
        let transaction = transactions[i];
        const privateKey = PrivateKey.generate();
        privateKeys.push(privateKey);
        keyList.push(privateKey.publicKey);
        transaction = await transaction.sign(privateKey);
        mockTransactionGroup.groupItems[i].transaction.transactionBytes = Buffer.from(
          transaction.toBytes(),
        );

        transaction.removeAllSignatures();
      }

      // Mock the functions
      jest.mocked(smartCollate).mockImplementation(async transaction => {
        for (let i = 0; i < 9; i++) {
          const _transaction = mockTransactionGroup.groupItems[i].transaction;

          if (_transaction.id === transaction.id) {
            privateKeys.slice(0, 5).forEach(key => transactions[i].sign(key));
            return transactions[i];
          }
        }
        return null;
      });
      jest.mocked(computeSignatureKey).mockResolvedValue(keyList);

      service.collateGroupAndExecute(mockTransactionGroup);

      await jest.advanceTimersToNextTimerAsync();

      expect(service.addGroupExecutionTimeout).not.toHaveBeenCalled();

      mockTransactionGroup.groupItems.forEach(groupItem => {
        // Verify that the update method was called with the correct parameters
        expect(transactionRepo.update).toHaveBeenCalledWith(
          { id: groupItem.transaction.id },
          {
            status: TransactionStatus.FAILED,
            executedAt: expect.any(Date), // Use expect.any(Date) to match any Date object
            statusCode: Status.TransactionOversize._code,
          },
        );
      });
    });

    it('should handle error in callback', async () => {
      jest.mocked(smartCollate).mockRejectedValue(new Error('Error'));

      service.collateGroupAndExecute(mockTransactionGroup);

      await jest.advanceTimersToNextTimerAsync();

      expect(service.addGroupExecutionTimeout).not.toHaveBeenCalled();
    });
  });

  describe('collateAndExecute', () => {
    let transaction: SDKTransaction;
    let mockTransaction: Transaction;
    let name: string;
    let timeToValidStart: number;

    beforeEach(async () => {
      jest.resetAllMocks();
      const validStart = new Date(Date.now() + 1000);
      transaction = new AccountCreateTransaction()
        .setNodeAccountIds([new AccountId(3)])
        .setTransactionId(
          TransactionId.withValidStart(new AccountId(3), Timestamp.fromDate(validStart)),
        )
        .setTransactionMemo('Test Transaction')
        .freeze();
      mockTransaction = {
        id: 1,
        validStart,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      } as Transaction;
      name = `smart_collate_timeout_${mockTransaction.id}`;

      timeToValidStart = mockTransaction.validStart.getTime() - Date.now();

      jest.useFakeTimers();
      jest.spyOn(global, 'setTimeout');
      jest.spyOn(schedulerRegistry, 'doesExist').mockReturnValue(false);
      jest.spyOn(schedulerRegistry, 'addTimeout');
      jest.spyOn(schedulerRegistry, 'deleteTimeout');
      jest.spyOn(executeService, 'executeTransaction').mockResolvedValue(undefined);
      jest.spyOn(service, 'addExecutionTimeout').mockImplementationOnce(jest.fn());
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should not set a timeout if one already exists', () => {
      schedulerRegistry.doesExist.mockReturnValueOnce(true);

      service.collateAndExecute(mockTransaction);

      expect(setTimeout).not.toHaveBeenCalled();
    });

    it('should set a timeout with the correct delay', () => {
      service.collateAndExecute(mockTransaction);

      expect(setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        expect.closeTo(timeToValidStart - 10 * 1000),
      );
    });

    it('should add the timeout to the scheduler registry', () => {
      service.collateAndExecute(mockTransaction);

      expect(schedulerRegistry.addTimeout).toHaveBeenCalledWith(name, expect.anything());
    });

    it('should prepare and execute a transaction signed with 50 different keys, reducing the signatures as needed', async () => {
      // prepare the signatures
      const keyList = new KeyList();
      const privateKeys = [];

      for (let i = 0; i < 50; i++) {
        const privateKey = PrivateKey.generate();
        privateKeys.push(privateKey);
        keyList.push(privateKey.publicKey);
        transaction = await transaction.sign(privateKey);
      }
      mockTransaction.transactionBytes = Buffer.from(transaction.toBytes());

      transaction.removeAllSignatures();

      privateKeys.slice(0, 5).forEach(key => transaction.sign(key));

      // Mock the functions
      jest.mocked(smartCollate).mockResolvedValueOnce(transaction);
      jest.mocked(computeSignatureKey).mockResolvedValueOnce(keyList);

      service.collateAndExecute(mockTransaction);

      await jest.advanceTimersToNextTimerAsync();

      expect(service.addExecutionTimeout).toHaveBeenCalled();

      const sdkTransaction = SDKTransaction.fromBytes(mockTransaction.transactionBytes);
      expect(sdkTransaction._signerPublicKeys.size).toBe(5);
    });

    it('should fail to prepare a signed transaction, due to key list unable to be sufficiently reduced', async () => {
      // prepare the signatures
      const keyList = new KeyList();
      const privateKeys = [];

      const privateKey = PrivateKey.generate();
      privateKeys.push(privateKey);
      keyList.push(privateKey.publicKey);
      transaction = await transaction.sign(privateKey);
      mockTransaction.transactionBytes = Buffer.from(transaction.toBytes());

      // Mock the functions
      jest.mocked(smartCollate).mockReturnValue(null);
      jest.mocked(computeSignatureKey).mockResolvedValue(keyList);

      jest.spyOn(transactionRepo, 'update').mockResolvedValue(undefined);

      service.collateAndExecute(mockTransaction);

      await jest.advanceTimersToNextTimerAsync();

      expect(service.addExecutionTimeout).not.toHaveBeenCalled();

      // Verify that the update method was called with the correct parameters
      expect(transactionRepo.update).toHaveBeenCalledWith(
        { id: mockTransaction.id },
        {
          status: TransactionStatus.FAILED,
          executedAt: expect.any(Date), // Use expect.any(Date) to match any Date object
          statusCode: Status.TransactionOversize._code,
        },
      );
    });

    it('should handle error in callback', async () => {
      jest.mocked(smartCollate).mockRejectedValue(new Error('Error'));

      service.collateAndExecute(mockTransaction);

      await jest.advanceTimersToNextTimerAsync();

      expect(service.addExecutionTimeout).not.toHaveBeenCalled();
    });
  });

  describe('addGroupExecutionTimeout', () => {
    const transactions: SDKTransaction[] = [];
    let mockTransactionGroup: TransactionGroup;
    let name: string;
    let timeToValidStart: number;

    beforeEach(async () => {
      jest.resetAllMocks();
      const validStart = new Date(Date.now());
      for (let i = 0; i < 10; i++) {
        const transaction = new AccountCreateTransaction()
          .setNodeAccountIds([new AccountId(3)])
          .setTransactionId(
            TransactionId.withValidStart(
              new AccountId(3),
              Timestamp.fromDate(new Date(validStart.getTime() + i * 1000)),
            ),
          )
          .setTransactionMemo('Test Transaction')
          .freeze();
        transactions.push(transaction);
      }
      mockTransactionGroup = {
        id: 1,
        description: 'Test Group',
        atomic: false,
        sequential: true,
        createdAt: new Date(),
        groupItems: [],
      } as TransactionGroup;
      for (let i = 0; i < 10; i++) {
        const mockTransaction = {
          id: i,
          validStart: new Date(validStart.getTime() + i * 1000),
          status: TransactionStatus.WAITING_FOR_EXECUTION,
        } as Transaction;
        mockTransactionGroup.groupItems.push({
          groupId: 1,
          seq: i,
          transaction: mockTransaction,
        } as TransactionGroupItem);
      }
      name = `group_execution_timeout_${mockTransactionGroup.id}`;

      timeToValidStart =
        mockTransactionGroup.groupItems[0].transaction.validStart.getTime() - Date.now();

      jest.useFakeTimers();
      jest.spyOn(global, 'setTimeout');
      jest.spyOn(schedulerRegistry, 'doesExist').mockReturnValue(false);
      jest.spyOn(schedulerRegistry, 'addTimeout');
      jest.spyOn(schedulerRegistry, 'deleteTimeout');
      jest.spyOn(executeService, 'executeTransactionGroup').mockResolvedValue(undefined);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should not set a timeout if one already exists', () => {
      schedulerRegistry.doesExist.mockReturnValueOnce(true);

      service.addGroupExecutionTimeout(mockTransactionGroup);

      expect(setTimeout).not.toHaveBeenCalled();
    });

    it('should set a timeout with the correct delay', () => {
      service.addGroupExecutionTimeout(mockTransactionGroup);

      expect(setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        expect.closeTo(timeToValidStart + 5 * 1000),
      );
    });

    it('should add the timeout to the scheduler registry', () => {
      service.addGroupExecutionTimeout(mockTransactionGroup);

      expect(schedulerRegistry.addTimeout).toHaveBeenCalledWith(name, expect.anything());
    });

    it('should execute the transaction and remove the timeout after the delay', async () => {
      service.addGroupExecutionTimeout(mockTransactionGroup);

      await jest.advanceTimersByTimeAsync(timeToValidStart + 5 * 1000);

      expect(executeService.executeTransactionGroup).toHaveBeenCalledWith(mockTransactionGroup);
    });

    it('should handle error in the timeout callback', async () => {
      jest.spyOn(executeService, 'executeTransactionGroup').mockRejectedValue(new Error('Error'));

      service.addGroupExecutionTimeout(mockTransactionGroup);

      await jest.advanceTimersToNextTimerAsync();

      expect(executeService.executeTransactionGroup).toHaveBeenCalledWith(mockTransactionGroup);
    });
  });

  describe('addExecutionTimeout', () => {
    let transaction: Transaction;
    let name: string;
    let timeToValidStart: number;

    beforeEach(() => {
      transaction = {
        id: 1,
        validStart: new Date(Date.now() + 1000),
      } as Transaction;
      name = `execution_timeout_${transaction.id}`;
      timeToValidStart = transaction.validStart.getTime() - Date.now();

      jest.useFakeTimers();
      jest.spyOn(global, 'setTimeout');
      jest.spyOn(schedulerRegistry, 'doesExist').mockReturnValue(false);
      jest.spyOn(schedulerRegistry, 'addTimeout');
      jest.spyOn(schedulerRegistry, 'deleteTimeout');
      jest.spyOn(executeService, 'executeTransaction').mockResolvedValue(undefined);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should not set a timeout if one already exists', () => {
      schedulerRegistry.doesExist.mockReturnValueOnce(true);

      service.addExecutionTimeout(transaction);

      expect(setTimeout).not.toHaveBeenCalled();
    });

    it('should set a timeout with the correct delay', () => {
      service.addExecutionTimeout(transaction);

      expect(setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        expect.closeTo(timeToValidStart + 5 * 1000),
      );
    });

    it('should not a timeout if the transaction is manual', () => {
      transaction.isManual = true;

      service.addExecutionTimeout(transaction);

      expect(setTimeout).not.toHaveBeenCalled();

      transaction.isManual = false;
    });

    it('should add the timeout to the scheduler registry', () => {
      service.addExecutionTimeout(transaction);

      expect(schedulerRegistry.addTimeout).toHaveBeenCalledWith(name, expect.anything());
    });

    it('should execute the transaction and remove the timeout after the delay', async () => {
      service.addExecutionTimeout(transaction);

      await jest.advanceTimersByTimeAsync(timeToValidStart + 5 * 1000);

      expect(executeService.executeTransaction).toHaveBeenCalledWith(transaction);
    });

    it('should handle error in the timeout callback', async () => {
      jest.spyOn(executeService, 'executeTransaction').mockRejectedValue(new Error('Error'));

      service.addExecutionTimeout(transaction);

      await jest.advanceTimersToNextTimerAsync();

      expect(executeService.executeTransaction).toHaveBeenCalledWith(transaction);
    });
  });

  describe('isValidStartExecutable', () => {
    it('should return true if the valid start is in range', () => {
      const validStart = new Date(Date.now() - 1000);

      expect(service.isValidStartExecutable(validStart)).toBe(true);
    });

    it('should return false if the valid start is in future', () => {
      const validStart = new Date(Date.now() + 1000);

      expect(service.isValidStartExecutable(validStart)).toBe(false);
    });

    it('should return false if the valid start has expired', () => {
      const validStart = new Date(Date.now() - 181 * 1_000);

      expect(service.isValidStartExecutable(validStart)).toBe(false);
    });
  });
});
