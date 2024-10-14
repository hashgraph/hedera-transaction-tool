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
  SYNC_INDICATORS,
  NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES,
  smartCollate,
  computeShortenedPublicKeyList,
  notifyTransactionAction,
} from '@app/common';
import { NotificationType, Transaction, TransactionStatus } from '@entities';

import { TransactionStatusService } from './transaction-status.service';
import { ExecuteService } from '../execute/execute.service';
import {
  AccountCreateTransaction,
  AccountId,
  FileAppendTransaction,
  FileUpdateTransaction,
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

describe('TransactionStatusService', () => {
  let service: TransactionStatusService;

  const transactionRepo = mockDeep<Repository<Transaction>>();
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

  it('should add execution timeout for transactions that are waiting for execution in initial cron', async () => {
    const transactions = [
      {
        validStart: new Date(new Date().getTime() - 10 * 1_000),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      },
    ];

    jest.spyOn(service, 'updateTransactions').mockResolvedValueOnce(transactions as Transaction[]);
    jest.spyOn(service, 'getValidStartNowMinus180Seconds').mockImplementationOnce(jest.fn());
    jest.spyOn(service, 'prepareAndExecute').mockImplementationOnce(jest.fn());

    await service.handleInitialTransactionStatusUpdate();

    expect(service.prepareAndExecute).toHaveBeenCalled();
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
    jest.spyOn(service, 'prepareAndExecute').mockImplementationOnce(jest.fn());

    await service.handleTransactionsBetweenNowAndAfterThreeMinutes();

    expect(service.prepareAndExecute).toHaveBeenCalled();
  });

  it('should updates for expired transactions', async () => {
    mockTransaction();

    const expiredTransactions = [
      { id: 1, status: TransactionStatus.NEW },
      { id: 2, status: TransactionStatus.REJECTED },
      { id: 3, status: TransactionStatus.WAITING_FOR_EXECUTION },
    ];

    transactionRepo.manager.find.mockResolvedValue(expiredTransactions as Transaction[]);

    await service.handleExpiredTransactions();

    expect(transactionRepo.manager.transaction).toHaveBeenCalled();
    expect(transactionRepo.manager.update).toHaveBeenCalled();

    for (const transaction of expiredTransactions) {
      expect(notificationsService.emit).toHaveBeenCalledWith(SYNC_INDICATORS, {
        transactionId: transaction.id,
        transactionStatus: TransactionStatus.EXPIRED,
      });
    }
    expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
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
        },
        {
          id: 2,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          transactionBytes: new AccountCreateTransaction().toBytes(),
          transactionId: '0.0.2',
          creatorKey: {
            userId: 24,
          },
        },
      ];

      transactionRepo.find.mockResolvedValue(transactions as Transaction[]);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(false);

      await service.updateTransactions(new Date(), new Date());

      expect(transactionRepo.update).toHaveBeenNthCalledWith(
        1,
        {
          id: 1,
        },
        {
          status: TransactionStatus.WAITING_FOR_EXECUTION,
        },
      );
      expect(transactionRepo.update).toHaveBeenNthCalledWith(
        2,
        {
          id: 2,
        },
        {
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
        },
      );
      expect(notificationsService.emit).toHaveBeenCalledWith(SYNC_INDICATORS, {
        transactionId: transactions[0].id,
        transactionStatus: TransactionStatus.WAITING_FOR_EXECUTION,
      });
      expect(notificationsService.emit).toHaveBeenCalledWith(NOTIFY_GENERAL, {
        entityId: transactions[0].id,
        type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
        actorId: null,
        content: `Transaction ${transactions[0].transactionId} is ready for execution`,
        userIds: [transactions[0].creatorKey?.userId],
      });
      expect(notificationsService.emit).toHaveBeenCalledWith(SYNC_INDICATORS, {
        transactionId: transactions[1].id,
        transactionStatus: TransactionStatus.WAITING_FOR_SIGNATURES,
      });
      expect(notificationsService.emit).toHaveBeenCalledWith(
        NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES,
        {
          transactionId: transactions[1].id,
        },
      );
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
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

      expect(notificationsService.emit).not.toHaveBeenCalled();
    });

    it.skip('should skip transaction if is file update or append', async () => {
      const transactions = [
        {
          id: 1,
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          transactionBytes: new FileUpdateTransaction().setContents('test').toBytes(),
        },
        {
          id: 2,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          transactionBytes: new AccountCreateTransaction().toBytes(),
        },
        {
          id: 3,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          transactionBytes: new FileAppendTransaction().setContents('test').toBytes(),
        },
      ];

      transactionRepo.find.mockResolvedValue(transactions as Transaction[]);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(false);

      await service.updateTransactions(new Date(), new Date());

      expect(transactionRepo.update).toHaveBeenCalledTimes(1);
      expect(notificationsService.emit).toHaveBeenCalledWith(SYNC_INDICATORS, {
        transactionId: transactions[1].id,
        transactionStatus: TransactionStatus.WAITING_FOR_SIGNATURES,
      });
      expect(notificationsService.emit).toHaveBeenCalledWith(
        NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES,
        {
          transactionId: transactions[1].id,
        },
      );
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
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
      };
      transactionRepo.findOne.mockResolvedValue(transaction as Transaction);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(true);

      await service.updateTransactionStatus({ id: transaction.id });

      expect(transactionRepo.update).toHaveBeenNthCalledWith(
        1,
        {
          id: 1,
        },
        {
          status: TransactionStatus.WAITING_FOR_EXECUTION,
        },
      );
      expect(notificationsService.emit).toHaveBeenCalledWith(SYNC_INDICATORS, {
        transactionId: transaction.id,
        transactionStatus: TransactionStatus.WAITING_FOR_EXECUTION,
      });
      expect(notificationsService.emit).toHaveBeenCalledWith(NOTIFY_GENERAL, {
        entityId: transaction.id,
        type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
        actorId: null,
        content: `Transaction ${transaction.transactionId} is ready for execution`,
        userIds: [transaction.creatorKey?.userId],
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

      expect(notificationsService.emit).not.toHaveBeenCalled();
    });

    it.skip('should skip transaction if is file update or append', async () => {
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        transactionBytes: new FileUpdateTransaction().toBytes(),
      };

      transactionRepo.findOne.mockResolvedValue(transaction as Transaction);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(hasValidSignatureKey).mockReturnValueOnce(false);

      await service.updateTransactionStatus({ id: transaction.id });

      expect(transactionRepo.update).not.toHaveBeenCalled();
      expect(notificationsService.emit).not.toHaveBeenCalled();
    });

    it('should return if transaction does not exist', async () => {
      transactionRepo.findOne.mockResolvedValue(undefined);

      await service.updateTransactionStatus({ id: 1 });

      expect(transactionRepo.findOne).toHaveBeenCalled();
      expect(transactionRepo.update).not.toHaveBeenCalled();
      expect(notificationsService.emit).not.toHaveBeenCalled();
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
      expect(notificationsService.emit).not.toHaveBeenCalled();
    });
  });

  describe('prepareAndExecute', () => {
    let transaction: SDKTransaction;
    let mockTransaction: Transaction;
    let name: string;
    let timeToValidStart: number;
    let keyList: KeyList;
    let privateKeys: PrivateKey[];

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

      service.prepareAndExecute(mockTransaction);

      expect(setTimeout).not.toHaveBeenCalled();
    });

    it('should set a timeout with the correct delay', () => {
      service.prepareAndExecute(mockTransaction);

      expect(setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        expect.closeTo(timeToValidStart - 10 * 1000),
      );
    });

    it('should add the timeout to the scheduler registry', () => {
      service.prepareAndExecute(mockTransaction);

      expect(schedulerRegistry.addTimeout).toHaveBeenCalledWith(name, expect.anything());
    });

    it('should prepare and execute a transaction signed with 50 different keys, reducing the signatures as needed', async () => {
      // prepare the signatures
      keyList = new KeyList();
      privateKeys = [];

      for (let i = 0; i < 50; i++) {
        const privateKey = PrivateKey.generate();
        privateKeys.push(privateKey);
        keyList.push(privateKey.publicKey);
        transaction = await transaction.sign(privateKey);
      }
      mockTransaction.transactionBytes = Buffer.from(transaction.toBytes());

      transaction.removeAllSignatures();

      privateKeys.slice(0,5).forEach(key => transaction.sign(key));

      // Mock the functions
      jest.mocked(smartCollate).mockResolvedValueOnce(transaction);
      jest.mocked(computeSignatureKey).mockResolvedValueOnce(keyList);

      service.prepareAndExecute(mockTransaction);

      await jest.advanceTimersToNextTimerAsync();

      expect(service.addExecutionTimeout).toHaveBeenCalled();

      const sdkTransaction = SDKTransaction.fromBytes(mockTransaction.transactionBytes);
      expect(sdkTransaction._signerPublicKeys.size).toBe(5);
    });

    it('should fail to prepare a transaction signed with 100 different keys, due to key list unable to be sufficiently reduced', async () => {
      // prepare the signatures
      keyList = new KeyList();
      privateKeys = [];

      const privateKey = PrivateKey.generate();
      privateKeys.push(privateKey);
      keyList.push(privateKey.publicKey);
      transaction = await transaction.sign(privateKey);
      mockTransaction.transactionBytes = Buffer.from(transaction.toBytes());

        // Mock the functions
        jest.mocked(smartCollate).mockReturnValue(null);
        jest.mocked(computeSignatureKey).mockResolvedValue(keyList);

        jest.spyOn(transactionRepo, 'update').mockResolvedValue(undefined);

        service.prepareAndExecute(mockTransaction);

        await jest.advanceTimersToNextTimerAsync();

        expect(service.addExecutionTimeout).not.toHaveBeenCalled();

        // Verify that the update method was called with the correct parameters
        expect(transactionRepo.update).toHaveBeenCalledWith(
          { id: mockTransaction.id },
          {
            status: TransactionStatus.FAILED,
            executedAt: expect.any(Date), // Use expect.any(Date) to match any Date object
            statusCode: Status.TransactionOversize._code,
          }
        );
      });
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

    it('should add the timeout to the scheduler registry', () => {
      service.addExecutionTimeout(transaction);

      expect(schedulerRegistry.addTimeout).toHaveBeenCalledWith(name, expect.anything());
    });

    it('should execute the transaction and remove the timeout after the delay', async () => {
      service.addExecutionTimeout(transaction);

      await jest.advanceTimersByTimeAsync(timeToValidStart + 5 * 1000);

      expect(executeService.executeTransaction).toHaveBeenCalledWith(transaction);
    });
  });
});
