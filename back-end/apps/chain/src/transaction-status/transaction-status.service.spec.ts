import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { SchedulerRegistry } from '@nestjs/schedule';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mockDeep } from 'jest-mock-extended';
import { Repository } from 'typeorm';

import {
  ableToSign,
  computeSignatureKey,
  MirrorNodeService,
  NOTIFICATIONS_SERVICE,
} from '@app/common';
import { Transaction, TransactionStatus } from '@entities';

import { TransactionStatusService } from './transaction-status.service';
import { ExecuteService } from '../execute/execute.service';
import {
  AccountCreateTransaction,
  FileAppendTransaction,
  FileUpdateTransaction,
  KeyList,
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
    jest.spyOn(service, 'addExecutionTimeout').mockImplementationOnce(jest.fn());

    await service.handleInitialTransactionStatusUpdate();

    expect(service.addExecutionTimeout).toHaveBeenCalled();
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

  it('should add execution timeout for transactions that are waiting for execution in initial cron', async () => {
    const transactions = [
      {
        validStart: new Date(new Date().getTime() - 10 * 1_000),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      },
    ];

    jest.spyOn(service, 'updateTransactions').mockResolvedValueOnce(transactions as Transaction[]);
    jest.spyOn(service, 'getValidStartNowMinus180Seconds').mockImplementationOnce(jest.fn());
    jest.spyOn(service, 'addExecutionTimeout').mockImplementationOnce(jest.fn());

    await service.handleTransactionsBetweenNowAndAfterThreeMinutes();

    expect(service.addExecutionTimeout).toHaveBeenCalled();
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
  });

  describe('update transactions', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should correctly update transactions statues', async () => {
      const transactions = [
        {
          id: 1,
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          body: new AccountCreateTransaction().toBytes(),
        },
        {
          id: 2,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          body: new AccountCreateTransaction().toBytes(),
        },
      ];

      transactionRepo.find.mockResolvedValue(transactions as Transaction[]);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(ableToSign).mockReturnValueOnce(true);
      jest.mocked(ableToSign).mockReturnValueOnce(false);

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
      expect(notificationsService.emit).toHaveBeenCalledTimes(2);
    });

    it('should not emit notifications event if no transactions updated', async () => {
      const transactions = [
        {
          id: 1,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          body: new AccountCreateTransaction().toBytes(),
        },
        {
          id: 2,
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          body: new AccountCreateTransaction().toBytes(),
        },
        {
          id: 3,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          body: new AccountCreateTransaction().toBytes(),
        },
      ];

      transactionRepo.find.mockResolvedValue(transactions as Transaction[]);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(ableToSign).mockReturnValueOnce(false);
      jest.mocked(ableToSign).mockReturnValueOnce(false);
      jest.mocked(ableToSign).mockReturnValueOnce(true);
      jest.spyOn(transactionRepo, 'update').mockRejectedValueOnce('Error');

      await service.updateTransactions(new Date(), new Date());

      expect(notificationsService.emit).not.toHaveBeenCalled();
    });

    it('should skip transaction if is file update or append', async () => {
      const transactions = [
        {
          id: 1,
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
          body: new FileUpdateTransaction().toBytes(),
        },
        {
          id: 2,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          body: new AccountCreateTransaction().toBytes(),
        },
        {
          id: 3,
          status: TransactionStatus.WAITING_FOR_EXECUTION,
          body: new FileAppendTransaction().toBytes(),
        },
      ];

      transactionRepo.find.mockResolvedValue(transactions as Transaction[]);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(ableToSign).mockReturnValueOnce(false);

      await service.updateTransactions(new Date(), new Date());

      expect(transactionRepo.update).toHaveBeenCalledTimes(1);
      expect(notificationsService.emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('update transaction status', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should correctly update transactions status', async () => {
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        body: new AccountCreateTransaction().toBytes(),
      };
      transactionRepo.findOne.mockResolvedValue(transaction as Transaction);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(ableToSign).mockReturnValueOnce(true);

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
      expect(notificationsService.emit).toHaveBeenCalledTimes(2);
    });

    it('should not emit notifications event if no transactions updated', async () => {
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        body: new AccountCreateTransaction().toBytes(),
      };

      transactionRepo.findOne.mockResolvedValue(transaction as Transaction);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(ableToSign).mockReturnValueOnce(false);
      jest.spyOn(transactionRepo, 'update').mockRejectedValueOnce(new Error('Error'));

      await expect(service.updateTransactionStatus({ id: transaction.id })).rejects.toThrow(
        'Error',
      );

      expect(notificationsService.emit).not.toHaveBeenCalled();
    });

    it('should skip transaction if is file update or append', async () => {
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        body: new FileUpdateTransaction().toBytes(),
      };

      transactionRepo.findOne.mockResolvedValue(transaction as Transaction);

      jest.mocked(computeSignatureKey).mockResolvedValue(new KeyList());
      jest.mocked(ableToSign).mockReturnValueOnce(false);

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
  });

  describe('addExecutionTimeout', () => {
    let transaction: Transaction;
    let name: string;
    let timeToValidStart: number;
    let callback: jest.Mock;

    beforeEach(() => {
      transaction = {
        id: 1,
        validStart: new Date(Date.now() + 1000),
      } as Transaction;
      name = `execution_timeout_${transaction.id}`;
      timeToValidStart = transaction.validStart.getTime() - Date.now();
      callback = jest.fn();

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

      jest.advanceTimersByTime(timeToValidStart + 5 * 1000);

      expect(executeService.executeTransaction).toHaveBeenCalledWith(transaction.id);
    });
  });
});
