import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { mock, mockDeep } from 'jest-mock-extended';
import {
  Brackets,
  DeepPartial,
  EntityManager,
  In,
  Not,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  AccountCreateTransaction,
  AccountId,
  PublicKey,
  TransactionId,
  Timestamp,
  Client,
} from '@hashgraph/sdk';

import { NOTIFICATIONS_SERVICE, MirrorNodeService, ErrorCodes, CHAIN_SERVICE } from '@app/common';
import {
  attachKeys,
  getClientFromNetwork,
  isExpired,
  userKeysRequiredToSign,
  notifyTransactionAction,
  notifyWaitingForSignatures,
  notifySyncIndicators,
  MirrorNetworkGRPC,
  isTransactionBodyOverMaxSize,
  emitExecuteTranasction,
  notifyGeneral,
} from '@app/common/utils';
import {
  NotificationType,
  Transaction,
  TransactionApprover,
  TransactionSigner,
  TransactionStatus,
  User,
  UserKey,
  UserStatus,
} from '@entities';

import { TransactionsService } from './transactions.service';
import { ApproversService } from './approvers';
import { CreateTransactionDto } from './dto';

jest.mock('@app/common/utils');

describe('TransactionsService', () => {
  let service: TransactionsService;

  const transactionsRepo = mockDeep<Repository<Transaction>>();
  const chainService = mock<ClientProxy>();
  const notificationsService = mock<ClientProxy>();
  const approversService = mock<ApproversService>();
  const mirrorNodeService = mock<MirrorNodeService>();
  const entityManager = mockDeep<EntityManager>();

  const user: Partial<User> = {
    id: 1,
    email: 'some@email.com',
    password: 'hash',
    admin: false,
    status: UserStatus.NONE,
  };

  const userWithKeys = {
    ...user,
    keys: [{ id: 1, publicKey: '0x', mnemonicHash: 'hash' }],
  } as User;

  const defaultPagination = {
    page: 1,
    limit: 10,
    offset: 0,
    size: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionsRepo,
        },
        {
          provide: NOTIFICATIONS_SERVICE,
          useValue: notificationsService,
        },
        {
          provide: CHAIN_SERVICE,
          useValue: chainService,
        },
        {
          provide: ApproversService,
          useValue: approversService,
        },
        {
          provide: MirrorNodeService,
          useValue: mirrorNodeService,
        },
        {
          provide: EntityManager,
          useValue: entityManager,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);

    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTransactionById', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should return transaction by id', async () => {
      const transaction: Partial<Transaction> = { id: 1 };

      jest.spyOn(transactionsRepo, 'findOne').mockResolvedValueOnce(transaction as Transaction);

      await service.getTransactionById(1);

      expect(transactionsRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['creatorKey', 'observers', 'comments', 'groupItem'],
      });

      expect(entityManager.find).toHaveBeenCalledWith(TransactionSigner, {
        where: {
          transaction: {
            id: transaction.id,
          },
        },
        relations: {
          userKey: true,
        },
        withDeleted: true,
      });
    });

    it('should return null if not transaction found', async () => {
      jest.spyOn(transactionsRepo, 'findOne').mockResolvedValueOnce(null);

      const result = await service.getTransactionById(1);

      expect(result).toBeNull();
    });

    it('should return null if no id provided', async () => {
      const result = await service.getTransactionById(null);

      expect(result).toBeNull();
    });
  });

  describe('getTransactions', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should return transactions', async () => {
      const transactions = [];
      const count = 0;

      const queryBuilder = {
        setFindOptions: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockImplementation(() => queryBuilder),
        getManyAndCount: jest.fn().mockResolvedValue([transactions, count]),
      };
      transactionsRepo.createQueryBuilder.mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<Transaction>,
      );

      const result = await service.getTransactions(user as User, defaultPagination, undefined, [
        {
          property: 'status',
          rule: 'eq',
          value: 'NEW',
        },
      ]);

      expect(transactionsRepo.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.setFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['creatorKey', 'groupItem', 'groupItem.group'],
          skip: 0,
          take: 10,
        }),
      );
      expect(queryBuilder.orWhere).toHaveBeenCalledWith(expect.any(Brackets));
      expect(result).toEqual({
        items: transactions,
        totalItems: count,
        page: defaultPagination.page,
        size: defaultPagination.size,
      });
    });
  });

  describe('getHistoryTransactions', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should return history transactions', async () => {
      const transactions = [];
      const count = 0;

      const queryBuilder = {
        setFindOptions: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockImplementation(() => queryBuilder),
        getManyAndCount: jest.fn().mockResolvedValue([transactions, count]),
      };
      transactionsRepo.createQueryBuilder.mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<Transaction>,
      );

      const result = await service.getHistoryTransactions(defaultPagination);

      expect(transactionsRepo.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.setFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['groupItem', 'groupItem.group'],
          skip: defaultPagination.offset,
          take: defaultPagination.limit,
        }),
      );
      expect(result).toEqual({
        items: transactions,
        totalItems: count,
        page: defaultPagination.page,
        size: defaultPagination.size,
      });
    });
  });

  describe('getTransactionsToSign', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should return empty array if user has no keys', async () => {
      jest.mocked(attachKeys).mockImplementationOnce(async (user: User) => {
        user.keys = [];
      });

      const result = await service.getTransactionsToSign(user as User, {
        page: 1,
        limit: 10,
        size: 10,
        offset: 0,
      });

      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
    });

    it('should handle no transactions to sign', async () => {
      entityManager.find.mockReturnValue(Promise.resolve([{ id: 1 }]));
      transactionsRepo.find.mockReturnValue(Promise.resolve([]));

      const result = await service.getTransactionsToSign(userWithKeys, {
        page: 1,
        limit: 10,
        size: 10,
        offset: 0,
      });
      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
    });

    it('should return transactions requiring signature', async () => {
      entityManager.find.mockReturnValue(Promise.resolve([{ id: 1 }]));
      transactionsRepo.find.mockResolvedValue([{ id: 1, name: 'Transaction 1' }] as Transaction[]);

      jest.spyOn(service, 'userKeysToSign').mockImplementation(() => Promise.resolve([1]));

      const result = await service.getTransactionsToSign(userWithKeys, {
        page: 1,
        limit: 10,
        size: 10,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.totalItems).toBe(1);
    });

    it('should hande an error and return the rest of the transactions', async () => {
      entityManager.find.mockReturnValue(Promise.resolve([{ id: 1 }, { id: 2 }]));
      transactionsRepo.find.mockResolvedValue([
        { id: 1, name: 'Transaction 1' },
        { id: 2, name: 'Transaction 2' },
      ] as Transaction[]);

      jest
        .spyOn(service, 'userKeysToSign')
        .mockResolvedValueOnce([1])
        .mockRejectedValueOnce(new Error('Error'));

      const result = await service.getTransactionsToSign(userWithKeys, {
        page: 1,
        limit: 10,
        size: 10,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.totalItems).toBe(1);
    });
  });

  describe('getTransactionsToApprove', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should return no transactions to approve for the user', async () => {
      transactionsRepo.createQueryBuilder.mockImplementation(
        () =>
          ({
            setFindOptions: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
          }) as unknown as SelectQueryBuilder<Transaction>,
      );

      const result = await service.getTransactionsToApprove(user as User, {
        page: 1,
        limit: 10,
        size: 10,
        offset: 0,
      });
      expect(result.totalItems).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('should return transactions to approve for the user', async () => {
      const mockTransactions = [{ id: 1 }, { id: 2 }];
      transactionsRepo.createQueryBuilder.mockImplementation(
        () =>
          ({
            setFindOptions: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn().mockResolvedValue([mockTransactions, 2]),
          }) as unknown as SelectQueryBuilder<Transaction>,
      );

      const result = await service.getTransactionsToApprove(user as User, {
        page: 1,
        limit: 10,
        size: 10,
        offset: 0,
      });
      expect(result.totalItems).toBe(2);
      expect(result.items).toHaveLength(2);
    });
  });

  const userKeys: UserKey[] = [
    {
      id: 1,
      publicKey: '61f37fc1bbf3ff4453712ee6a305c5c7255955f7889ec3bf30426f1863158ef4',
      mnemonicHash: 'hash',
      userId: 1,
      index: 1,
      user: user as User,
      createdTransactions: [],
      approvedTransactions: [],
      signedTransactions: [],
      deletedAt: null,
    },
  ];

  describe('createTransaction', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = userKeys;
      });
    });

    it('should create a transaction', async () => {
      const sdkTransaction = new AccountCreateTransaction().setTransactionId(
        new TransactionId(AccountId.fromString('0.0.1'), Timestamp.fromDate(new Date())),
      );

      const dto: CreateTransactionDto = {
        name: 'Transaction 1',
        description: 'Description',
        transactionBytes: Buffer.from(sdkTransaction.toBytes()),
        creatorKeyId: 1,
        signature: Buffer.from('0xabc02'),
        mirrorNetwork: 'testnet',
      };

      const client = Client.forTestnet();

      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = userKeys;
      });
      jest.spyOn(PublicKey.prototype, 'verify').mockReturnValueOnce(true);
      jest.mocked(isExpired).mockReturnValueOnce(false);
      jest.mocked(isTransactionBodyOverMaxSize).mockReturnValueOnce(false);
      transactionsRepo.count.mockResolvedValueOnce(0);
      jest.spyOn(MirrorNetworkGRPC, 'fromBaseURL').mockReturnValueOnce(MirrorNetworkGRPC.TESTNET);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      transactionsRepo.create.mockImplementationOnce(
        (input: DeepPartial<Transaction>) => ({ ...input }) as Transaction,
      );
      transactionsRepo.save.mockImplementationOnce(async (t: Transaction) => {
        t.id = 1;
        return t;
      });

      await service.createTransaction(dto, user as User);

      expect(transactionsRepo.save).toHaveBeenCalled();
      expect(notifyWaitingForSignatures).toHaveBeenCalledWith(
        notificationsService,
        1,
        dto.mirrorNetwork,
      );
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);

      client.close();
    });

    it('should create a manual transaction', async () => {
      const sdkTransaction = new AccountCreateTransaction().setTransactionId(
        new TransactionId(AccountId.fromString('0.0.1'), Timestamp.fromDate(new Date())),
      );

      const dto: CreateTransactionDto = {
        name: 'Transaction 1',
        description: 'Description',
        transactionBytes: Buffer.from(sdkTransaction.toBytes()),
        creatorKeyId: 1,
        signature: Buffer.from('0xabc02'),
        mirrorNetwork: 'testnet',
        isManual: true,
      };

      const client = Client.forTestnet();

      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = userKeys;
      });
      jest.spyOn(PublicKey.prototype, 'verify').mockReturnValueOnce(true);
      jest.mocked(isExpired).mockReturnValueOnce(false);
      jest.mocked(isTransactionBodyOverMaxSize).mockReturnValueOnce(false);
      transactionsRepo.count.mockResolvedValueOnce(0);
      jest.spyOn(MirrorNetworkGRPC, 'fromBaseURL').mockReturnValueOnce(MirrorNetworkGRPC.TESTNET);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      transactionsRepo.create.mockImplementationOnce(
        (input: DeepPartial<Transaction>) => ({ ...input }) as Transaction,
      );
      transactionsRepo.save.mockImplementationOnce(async (t: Transaction) => {
        t.id = 1;
        return t;
      });

      await service.createTransaction(dto, user as User);

      expect(transactionsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isManual: true }),
      );
      expect(notifyWaitingForSignatures).toHaveBeenCalledWith(
        notificationsService,
        1,
        dto.mirrorNetwork,
      );
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);

      client.close();
    });

    it.skip('should throw on transaction create if transaction creator not same', async () => {
      const dto: CreateTransactionDto = {
        name: 'Transaction 1',
        description: 'Description',
        transactionBytes: Buffer.from('as'),
        creatorKeyId: 2,
        signature: Buffer.from('0xabc02'),
        mirrorNetwork: 'testnet',
      };

      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = userKeys;
      });

      await expect(service.createTransaction(dto, user as User)).rejects.toThrow(
        "Creator key doesn't belong to the user",
      );
    });

    it('should throw on transaction create if invalid signature', async () => {
      const dto: CreateTransactionDto = {
        name: 'Transaction 1',
        description: 'Description',
        transactionBytes: Buffer.from('0x1234acf12e'),
        creatorKeyId: 1,
        signature: Buffer.from('0xabc02'),
        mirrorNetwork: 'testnet',
      };

      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = userKeys;
      });
      jest.spyOn(PublicKey.prototype, 'verify').mockReturnValueOnce(false);

      await expect(service.createTransaction(dto, user as User)).rejects.toThrow(ErrorCodes.SNMP);
    });

    it('should throw on transaction create if expired', async () => {
      const sdkTransaction = new AccountCreateTransaction();

      const dto: CreateTransactionDto = {
        name: 'Transaction 1',
        description: 'Description',
        transactionBytes: Buffer.from(sdkTransaction.toBytes()),
        creatorKeyId: 1,
        signature: Buffer.from('0xabc02'),
        mirrorNetwork: 'testnet',
      };

      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = userKeys;
      });
      jest.spyOn(PublicKey.prototype, 'verify').mockReturnValueOnce(true);
      jest.mocked(isExpired).mockReturnValueOnce(true);

      await expect(service.createTransaction(dto, user as User)).rejects.toThrow(ErrorCodes.TE);
    });

    it('should throw on transaction create if save fails', async () => {
      const sdkTransaction = new AccountCreateTransaction().setTransactionId(
        new TransactionId(AccountId.fromString('0.0.1'), Timestamp.fromDate(new Date())),
      );

      const dto: CreateTransactionDto = {
        name: 'Transaction 1',
        description: 'Description',
        transactionBytes: Buffer.from(sdkTransaction.toBytes()),
        creatorKeyId: 1,
        signature: Buffer.from('0xabc02'),
        mirrorNetwork: 'testnet',
      };

      const client = Client.forTestnet();

      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = userKeys;
      });
      jest.spyOn(PublicKey.prototype, 'verify').mockReturnValueOnce(true);
      jest.mocked(isExpired).mockReturnValueOnce(false);
      jest.mocked(isTransactionBodyOverMaxSize).mockReturnValueOnce(false);
      transactionsRepo.count.mockResolvedValueOnce(0);
      jest.spyOn(MirrorNetworkGRPC, 'fromBaseURL').mockReturnValueOnce(MirrorNetworkGRPC.TESTNET);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      transactionsRepo.save.mockRejectedValueOnce(new Error('Failed to save'));

      await expect(service.createTransaction(dto, user as User)).rejects.toThrow(ErrorCodes.FST);

      client.close();
    });

    it('should throw on transaction create if transaction over max size', async () => {
      const sdkTransaction = new AccountCreateTransaction().setTransactionId(
        new TransactionId(AccountId.fromString('0.0.1'), Timestamp.fromDate(new Date())),
      );

      const dto: CreateTransactionDto = {
        name: 'Transaction 1',
        description: 'Description',
        transactionBytes: Buffer.from(sdkTransaction.toBytes()),
        creatorKeyId: 1,
        signature: Buffer.from('0xabc02'),
        mirrorNetwork: 'testnet',
      };

      const client = Client.forTestnet();

      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = userKeys;
      });
      jest.spyOn(PublicKey.prototype, 'verify').mockReturnValueOnce(true);
      jest.mocked(isExpired).mockReturnValueOnce(false);
      jest.mocked(isTransactionBodyOverMaxSize).mockReturnValueOnce(true);

      await expect(service.createTransaction(dto, user as User)).rejects.toThrow(ErrorCodes.TOS);

      client.close();
    });
  });

  describe('removeTransaction', () => {
    const transaction = { id: 123, creatorKey: { userId: user.id }, mirrorNetwork: 'testnet' };

    beforeEach(() => {
      jest.resetAllMocks();
      jest
        .spyOn(service, 'getTransactionForCreator')
        .mockResolvedValueOnce(transaction as Transaction);
    });

    afterEach(() => {
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        TransactionStatus.CANCELED,
        transaction.mirrorNetwork,
      );
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
    });

    it('should soft remove the transaction', async () => {
      await service.removeTransaction(123, user as User, true);
      expect(transactionsRepo.softRemove).toHaveBeenCalledWith(transaction);
    });

    it('should hard remove the transaction', async () => {
      await service.removeTransaction(123, user as User, false);
      expect(transactionsRepo.remove).toHaveBeenCalledWith(transaction);
    });
  });

  describe('cancelTransaction', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should throw if transaction status is not cancelable', async () => {
      const transaction = {
        creatorKey: { userId: 1 },
        status: TransactionStatus.EXECUTED,
      };

      jest
        .spyOn(service, 'getTransactionForCreator')
        .mockResolvedValueOnce(transaction as Transaction);

      await expect(service.cancelTransaction(123, { id: 1 } as User)).rejects.toThrow(
        ErrorCodes.OTIP,
      );
    });

    it('should update transaction status to CANCELED and return true', async () => {
      const transaction = {
        id: 123,
        creatorKey: { userId: 1 },
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        mirrorNetwork: 'testnet',
      };

      jest
        .spyOn(service, 'getTransactionForCreator')
        .mockResolvedValueOnce(transaction as Transaction);

      const result = await service.cancelTransaction(123, { id: 1 } as User);

      expect(transactionsRepo.update).toHaveBeenCalledWith(
        { id: 123 },
        { status: TransactionStatus.CANCELED },
      );
      expect(result).toBe(true);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        TransactionStatus.CANCELED,
        transaction.mirrorNetwork,
      );
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
    });

    it('should emit notification to the notifiaction service', async () => {
      const transaction = {
        id: 123,
        creatorKey: { userId: 1 },
        observers: [{ userId: 2 }],
        signers: [{ userId: 3 }],
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      };

      jest
        .spyOn(service, 'getTransactionForCreator')
        .mockResolvedValueOnce(transaction as Transaction);

      await service.cancelTransaction(123, { id: 1 } as User);

      expect(notifyGeneral).toHaveBeenCalledWith(
        notificationsService,
        NotificationType.TRANSACTION_CANCELLED,
        expect.arrayContaining([2, 3]),
        expect.any(String),
        123,
      );
    });
  });

  describe('archiveTransaction', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should throw if transaction status is not archiveable', async () => {
      const transaction = {
        creatorKey: { userId: 1 },
        status: TransactionStatus.CANCELED,
      };

      jest
        .spyOn(service, 'getTransactionForCreator')
        .mockResolvedValueOnce(transaction as Transaction);

      await expect(service.archiveTransaction(123, { id: 1 } as User)).rejects.toThrow(
        ErrorCodes.OMTIP,
      );
    });

    it('should update transaction status to ARCHIVED and return true', async () => {
      const transaction = {
        id: 123,
        creatorKey: { userId: 1 },
        isManual: true,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        mirrorNetwork: 'testnet',
      };

      jest
        .spyOn(service, 'getTransactionForCreator')
        .mockResolvedValueOnce(transaction as Transaction);

      const result = await service.archiveTransaction(123, { id: 1 } as User);

      expect(transactionsRepo.update).toHaveBeenCalledWith(
        { id: 123 },
        { status: TransactionStatus.ARCHIVED },
      );
      expect(result).toBe(true);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        TransactionStatus.ARCHIVED,
        transaction.mirrorNetwork,
      );
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
    });
  });

  describe('executeTransaction', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should throw if transaction is not manual', async () => {
      const transaction = {
        id: 123,
        creatorKey: { userId: user.id },
        isManual: false,
      };

      jest
        .spyOn(service, 'getTransactionForCreator')
        .mockResolvedValueOnce(transaction as Transaction);

      await expect(service.executeTransaction(123, user as User)).rejects.toThrow(ErrorCodes.IO);
    });

    it('should emit execute transaction event and return true if transaction is manual', async () => {
      const transaction = {
        id: 123,
        creatorKey: { userId: user.id },
        isManual: true,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        transactionBytes: Buffer.from('transactionBytes'),
        mirrorNetwork: 'testnet',
        validStart: new Date(),
      };

      jest
        .spyOn(service, 'getTransactionForCreator')
        .mockResolvedValueOnce(transaction as Transaction);

      const result = await service.executeTransaction(123, user as User);

      expect(result).toBe(true);
      expect(emitExecuteTranasction).toHaveBeenCalledWith(chainService, {
        id: transaction.id,
        status: transaction.status,
        transactionBytes: transaction.transactionBytes.toString('hex'),
        mirrorNetwork: transaction.mirrorNetwork,
        validStart: transaction.validStart,
      });
    });
  });

  describe('getTransactionWithVerifiedAccess', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should throw if transaction ID is not provided', async () => {
      await expect(service.getTransactionWithVerifiedAccess(null, user as User)).rejects.toThrow(
        ErrorCodes.TNF,
      );
    });

    it('should throw if transaction is not found', async () => {
      transactionsRepo.findOne.mockResolvedValue(null);

      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([]);
      await expect(service.getTransactionWithVerifiedAccess(123, user as User)).rejects.toThrow(
        ErrorCodes.TNF,
      );
    });

    it('should return the transaction if the user is the creator', async () => {
      const transaction = { id: 123, creatorKey: { userId: user.id }, observers: [] };

      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([]);
      jest.spyOn(approversService, 'getApproversByTransactionId').mockResolvedValueOnce([]);
      transactionsRepo.findOne.mockResolvedValue(transaction as Transaction);

      await expect(service.getTransactionWithVerifiedAccess(123, user as User)).resolves.toEqual(
        transaction,
      );
    });

    it('should return the transaction if the user is a signer', async () => {
      const transaction = {
        id: 123,
        observers: [],
      };

      entityManager.find.mockResolvedValueOnce([
        {
          userKey: {
            userId: user.id,
          },
        },
      ]);

      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([]);
      jest.spyOn(approversService, 'getApproversByTransactionId').mockResolvedValueOnce([]);
      transactionsRepo.findOne.mockResolvedValue(transaction as Transaction);

      await expect(service.getTransactionWithVerifiedAccess(123, user as User)).resolves.toEqual(
        transaction,
      );
    });

    it('should return the transaction if the user is an observer', async () => {
      const transaction = {
        id: 123,
        observers: [{ userId: user.id }],
      };

      entityManager.find.mockResolvedValueOnce([]);
      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([]);
      jest.spyOn(approversService, 'getApproversByTransactionId').mockResolvedValueOnce([]);
      transactionsRepo.findOne.mockResolvedValue(transaction as Transaction);

      await expect(service.getTransactionWithVerifiedAccess(123, user as User)).resolves.toEqual(
        transaction,
      );
    });

    it('should return the transaction if the user is an approver', async () => {
      const transaction = {
        id: 123,
        observers: [],
      };

      const approvers: TransactionApprover[] = [{ userId: user.id }] as TransactionApprover[];

      entityManager.find.mockResolvedValueOnce([]);
      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([]);
      jest.spyOn(approversService, 'getApproversByTransactionId').mockResolvedValueOnce(approvers);
      jest.spyOn(approversService, 'getTreeStructure').mockReturnValue(approvers);
      transactionsRepo.findOne.mockResolvedValue(transaction as Transaction);

      await expect(service.getTransactionWithVerifiedAccess(123, user as User)).resolves.toEqual(
        transaction,
      );
    });

    it('should throw if the user does not have verified access', async () => {
      const transaction = {
        id: 123,
        creatorKey: { userId: 2 },
        observers: [],
      };

      entityManager.find.mockResolvedValueOnce([]);
      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([]);
      jest.spyOn(approversService, 'getApproversByTransactionId').mockResolvedValueOnce([]);
      jest.spyOn(approversService, 'getTreeStructure').mockReturnValue([]);
      transactionsRepo.findOne.mockResolvedValue(transaction as Transaction);

      await expect(service.getTransactionWithVerifiedAccess(123, user as User)).rejects.toThrow(
        "You don't have permission to view this transaction",
      );
    });

    it('should return null if the user does not have verified access', async () => {
      const transaction = {
        id: 123,
        status: TransactionStatus.EXECUTED,
      };

      entityManager.find.mockResolvedValueOnce([]);
      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([]);
      jest.spyOn(approversService, 'getApproversByTransactionId').mockResolvedValueOnce([]);
      jest.spyOn(approversService, 'getTreeStructure').mockReturnValue([]);
      transactionsRepo.findOne.mockResolvedValue(transaction as Transaction);

      await expect(service.getTransactionWithVerifiedAccess(123, user as User)).resolves.toEqual(
        transaction,
      );
    });
  });

  describe('attachTransactionSigners', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should attach the signers to the transaction', async () => {
      const transaction = {
        id: 123,
      };

      entityManager.find.mockResolvedValueOnce([]);

      await service.attachTransactionSigners(transaction as Transaction);

      expect(entityManager.find).toHaveBeenCalledWith(TransactionSigner, {
        where: {
          transaction: {
            id: transaction.id,
          },
        },
        relations: ['userKey'],
        withDeleted: true,
      });
    });

    it('should throw if not transaction is passed to attachTransactionSigners', async () => {
      await expect(service.attachTransactionSigners(null)).rejects.toThrow(ErrorCodes.TNF);
    });
  });

  describe('userKeysToSign', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should call user keys required with correct arguments', async () => {
      const transaction = { id: 123 };

      await service.userKeysToSign(transaction as Transaction, user as User);

      expect(jest.mocked(userKeysRequiredToSign)).toHaveBeenCalledWith(
        transaction,
        user,
        mirrorNodeService,
        entityManager,
      );
    });
  });

  describe('shouldApproveTransaction', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should return true if user has not sent an approve signature', async () => {
      const transactionId = 123;
      const approvers: TransactionApprover[] = [
        { userId: user.id },
      ] as unknown as TransactionApprover[];

      jest.spyOn(approversService, 'getApproversByTransactionId').mockResolvedValueOnce(approvers);

      const result = await service.shouldApproveTransaction(transactionId, user as User);

      expect(result).toBe(true);
    });

    it('should return false if a user has already send approval', async () => {
      const transactionId = 123;
      const approvers: TransactionApprover[] = [
        { userId: user.id, signature: '0x' },
      ] as unknown as TransactionApprover[];

      jest.spyOn(approversService, 'getApproversByTransactionId').mockResolvedValueOnce(approvers);

      const result = await service.shouldApproveTransaction(transactionId, user as User);

      expect(result).toBe(false);
    });

    it('should reeturn false if a user is not in the approvers list', async () => {
      const transactionId = 123;
      const approvers: TransactionApprover[] = [];

      jest.spyOn(approversService, 'getApproversByTransactionId').mockResolvedValueOnce(approvers);

      const result = await service.shouldApproveTransaction(transactionId, user as User);

      expect(result).toBe(false);
    });
  });

  describe('getHistoryWhere', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    const allowedStatuses = [
      TransactionStatus.EXECUTED,
      TransactionStatus.FAILED,
      TransactionStatus.EXPIRED,
      TransactionStatus.CANCELED,
      TransactionStatus.ARCHIVED,
    ];
    const forbiddenStatuses = Object.values(TransactionStatus).filter(
      s => !allowedStatuses.includes(s),
    );

    const mockQueryBuilder = () => {
      const queryBuilder = {
        setFindOptions: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockImplementation(() => queryBuilder),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      transactionsRepo.createQueryBuilder.mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<Transaction>,
      );

      return queryBuilder;
    };

    it('should return where only with allowed statuses if not filter provided', async () => {
      const queryBuilder = mockQueryBuilder();

      await service.getHistoryTransactions(defaultPagination);

      expect(queryBuilder.setFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: Not(In(forbiddenStatuses)),
          }),
        }),
      );
    });

    it('should return where only with with allowed status if EQ filter provided', async () => {
      const queryBuilder = mockQueryBuilder();

      await service.getHistoryTransactions(defaultPagination, [
        {
          property: 'status',
          rule: 'eq',
          value: 'EXECUTED',
        },
      ]);

      expect(queryBuilder.setFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'EXECUTED',
          }),
        }),
      );
    });

    it('should return where with allowed statuses if malicious EQ filter provided', async () => {
      const queryBuilder = mockQueryBuilder();

      await service.getHistoryTransactions(defaultPagination, [
        {
          property: 'status',
          rule: 'eq',
          value: 'WAITING FOR EXECUTION',
        },
      ]);

      expect(queryBuilder.setFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: Not(In(forbiddenStatuses)),
          }),
        }),
      );
    });

    it('should return where only with with allowed statuses if IN filter provided', async () => {
      const queryBuilder = mockQueryBuilder();

      await service.getHistoryTransactions(defaultPagination, [
        {
          property: 'status',
          rule: 'in',
          value: 'EXECUTED, WAITING FOR EXECUTION, WAITING FOR SIGNATURES, FAILED',
        },
      ]);

      expect(queryBuilder.setFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: In([TransactionStatus.EXECUTED, TransactionStatus.FAILED]),
          }),
        }),
      );
    });

    it('should return where only with with allowed statuses if malicious IN filter provided', async () => {
      const queryBuilder = mockQueryBuilder();

      await service.getHistoryTransactions(defaultPagination, [
        {
          property: 'status',
          rule: 'in',
          value: 'NEW, WAITING FOR EXECUTION, WAITING FOR SIGNATURES, REJECTED',
        },
      ]);

      expect(queryBuilder.setFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: In([]),
          }),
        }),
      );
    });

    it('should return where only with with allowed status if NEQ filter provided', async () => {
      const queryBuilder = mockQueryBuilder();

      await service.getHistoryTransactions(defaultPagination, [
        {
          property: 'status',
          rule: 'neq',
          value: 'EXECUTED',
        },
      ]);

      expect(queryBuilder.setFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: Not(In([...forbiddenStatuses, TransactionStatus.EXECUTED])),
          }),
        }),
      );
    });

    it('should return where only with with allowed statuses if NIN filter provided', async () => {
      const queryBuilder = mockQueryBuilder();

      await service.getHistoryTransactions(defaultPagination, [
        {
          property: 'status',
          rule: 'nin',
          value: 'EXECUTED, FAILED,EXPIRED',
        },
      ]);

      expect(queryBuilder.setFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: Not(
              In([
                ...forbiddenStatuses,
                TransactionStatus.EXECUTED,
                TransactionStatus.FAILED,
                TransactionStatus.EXPIRED,
              ]),
            ),
          }),
        }),
      );
    });

    it('should return where only with with allowed statuses if unsupported filter', async () => {
      const queryBuilder = mockQueryBuilder();

      await service.getHistoryTransactions(defaultPagination, [
        {
          property: 'status',
          rule: 'geteverythingpossiblerule',
          value: 'EXECUTED,FAILED,EXPIRED',
        },
      ]);

      expect(queryBuilder.setFindOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: Not(In([...forbiddenStatuses])),
          }),
        }),
      );
    });
  });

  describe('getTransactionForCreator', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should return null if no transaction id provided', async () => {
      await expect(service.getTransactionForCreator(null, user as User)).rejects.toThrow(
        ErrorCodes.TNF,
      );
    });

    it('should return null if no transaction found', async () => {
      await expect(service.getTransactionForCreator(null, user as User)).rejects.toThrow(
        ErrorCodes.TNF,
      );
    });

    it('should throw if no user is provided', async () => {
      const transaction = { creatorKey: { userId: 2 } };
      transactionsRepo.findOne.mockResolvedValueOnce(transaction as Transaction);

      await expect(service.getTransactionForCreator(1, null)).rejects.toThrow(
        'Only the creator has access to this transaction',
      );
    });

    it('should throw if user is not the creator', async () => {
      const transaction = { creatorKey: { userId: 231232 } };

      transactionsRepo.findOne.mockResolvedValueOnce(transaction as Transaction);

      await expect(service.getTransactionForCreator(1, user as User)).rejects.toThrow(
        'Only the creator has access to this transaction',
      );
    });

    it('should return the transaction if user is the creator', async () => {
      const transaction = { creatorKey: { userId: user.id } };

      transactionsRepo.findOne.mockResolvedValueOnce(transaction as Transaction);

      const result = await service.getTransactionForCreator(1, user as User);

      expect(result).toEqual(transaction);
    });
  });
});
