import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mock, mockDeep } from 'jest-mock-extended';
import { Brackets, DeepPartial, EntityManager, In, Not, Repository, SelectQueryBuilder } from 'typeorm';
import {
  AccountCreateTransaction,
  AccountId,
  AccountUpdateTransaction,
  Client,
  Long,
  NodeCreateTransaction,
  NodeUpdateTransaction,
  PrivateKey,
  PublicKey,
  SignatureMap,
  Timestamp,
  TransactionId,
} from '@hashgraph/sdk';

import {
  emitTransactionStatusUpdate,
  ErrorCodes,
  ExecuteService,
  flattenKeyList,
  NatsPublisherService,
  safe,
  SchedulerService,
  SqlBuilderService,
  TransactionSignatureService,
} from '@app/common';
import {
  attachKeys,
  getClientFromNetwork,
  getTransactionSignReminderKey,
  getTransactionTypeEnumValue,
  isExpired,
  isTransactionBodyOverMaxSize,
  MirrorNetworkGRPC,
  userKeysRequiredToSign,
} from '@app/common/utils';
import {
  Transaction,
  TransactionApprover,
  TransactionSigner,
  TransactionStatus,
  TransactionType,
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
  const notificationsPublisher = mock<NatsPublisherService>();
  const approversService = mock<ApproversService>();
  const transactionSignatureService = mock<TransactionSignatureService>();
  const schedulerService = mock<SchedulerService>();
  const executeService = mockDeep<ExecuteService>();
  const sqlBuilderService = mockDeep<SqlBuilderService>();
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
          provide: NatsPublisherService,
          useValue: notificationsPublisher,
        },
        {
          provide: ApproversService,
          useValue: approversService,
        },
        {
          provide: TransactionSignatureService,
          useValue: transactionSignatureService,
        },
        {
          provide: EntityManager,
          useValue: entityManager,
        },
        {
          provide: SchedulerService,
          useValue: schedulerService,
        },
        {
          provide: SqlBuilderService,
          useValue: sqlBuilderService
        },
        {
          provide: ExecuteService,
          useValue: executeService,
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
        relations: ['creatorKey', 'creatorKey.user', 'observers', 'comments', 'groupItem'],
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
      // execute the Brackets callback so the arrow function inside `new Brackets(qb => ...)` actually runs
      const bracketsArg = (queryBuilder.orWhere as jest.Mock).mock.calls[0][0];

      // try several possible property names where TypeORM stores the callback
      const maybeFn =
        (bracketsArg as any).whereFactory ||
        (bracketsArg as any)._whereFactory ||
        (bracketsArg as any).whereFn ||
        (bracketsArg as any).builderFactory;

      // if found, call it with a fake qb that implements where/andWhere
      if (typeof maybeFn === 'function') {
        const fakeQb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis() };
        maybeFn.call(bracketsArg, fakeQb);
        expect((fakeQb.andWhere as jest.Mock).mock.calls.length).toBeGreaterThan(0);
      }
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
      const queryBuilder: Partial<SelectQueryBuilder<Transaction>> & {
        setFindOptions: jest.Mock;
        where: jest.Mock;
        getManyAndCount: jest.Mock;
      } = {
        setFindOptions: jest.fn().mockReturnThis(),
        // keep the same object returned so tests can read `queryBuilder.where.mock.calls`
        where: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockTransactions, 2]),
      };

      transactionsRepo.createQueryBuilder.mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<Transaction>,
      );

      const result = await service.getTransactionsToApprove(user as User, {
        page: 1,
        limit: 10,
        size: 10,
        offset: 0,
      });
      expect(result.totalItems).toBe(2);
      expect(result.items).toHaveLength(2);
      // execute the Brackets callback so the arrow function inside `new Brackets(qb => ...)` actually runs
      const whereArg = (queryBuilder.where as jest.Mock).mock.calls[0][0];

      // try several possible property names where TypeORM stores the callback
      const maybeFn =
        (whereArg as any).whereFactory ||
        (whereArg as any)._whereFactory ||
        (whereArg as any).whereFn ||
        (whereArg as any).builderFactory ||
        (whereArg as any).whereCallback;

      if (typeof maybeFn === 'function') {
        const fakeQb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis() };
        maybeFn.call(whereArg, fakeQb);
        expect((fakeQb.andWhere as jest.Mock).mock.calls.length).toBeGreaterThan(0);
      }
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
    const transactionEntityManger = mockDeep<EntityManager>();
    let saveMock: jest.Mock<Promise<any>, any[]>;

    beforeEach(() => {
      jest.resetAllMocks();
      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = userKeys;
      });

      saveMock = jest.fn().mockImplementation(async (entityOrTarget: any, data?: any) => {
        const items = Array.isArray(data) ? data : Array.isArray(entityOrTarget) ? entityOrTarget : [entityOrTarget];
        items.forEach((d: any, i: number) => {
          if (!d.id) d.id = i + 1;
          if (!d.validStart) d.validStart = d.validStart ?? new Date();
        });
        return Array.isArray(data) ? items : items[0];
      });
      transactionEntityManger.save = saveMock as any;


      entityManager.transaction.mockImplementation(async (arg1?: any, arg2?: any) => {
        const cb = typeof arg1 === 'function' ? arg1 : typeof arg2 === 'function' ? arg2 : undefined;
        if (!cb) throw new Error('No transaction callback provided in mock');
        return cb(transactionEntityManger);
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
        reminderMillisecondsBefore: 60 * 1_000,
      };



      const client = Client.forTestnet();

      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = userKeys;
      });
      jest.spyOn(PublicKey.prototype, 'verify').mockReturnValueOnce(true);
      jest.mocked(isExpired).mockReturnValueOnce(false);
      jest.mocked(isTransactionBodyOverMaxSize).mockReturnValueOnce(false);
      transactionsRepo.find.mockResolvedValueOnce([]);
      jest.spyOn(MirrorNetworkGRPC, 'fromBaseURL').mockReturnValueOnce(MirrorNetworkGRPC.TESTNET);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      transactionsRepo.create.mockImplementationOnce(
        (input: DeepPartial<Transaction>) => ({ ...input }) as Transaction,
      );
      jest.mocked(getTransactionSignReminderKey).mockReturnValueOnce('transaction:sign:1');

      await service.createTransaction(dto, user as User);

      expect(saveMock).toHaveBeenCalled();
      expect(emitTransactionStatusUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        [{ entityId: 1 }],
      );
      expect(schedulerService.addReminder).toHaveBeenCalledWith(
        `transaction:sign:1`,
        expect.any(Date),
      );

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
      transactionsRepo.find.mockResolvedValueOnce([]);
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

      expect(transactionsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isManual: true }),
      );
      expect(saveMock).toHaveBeenCalled();
      expect(emitTransactionStatusUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        [{ entityId: 1 }],
      );


      client.close();
    });

    it('should throw if transaction already exists', async () => {
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

      transactionsRepo.find.mockResolvedValueOnce([{ transactionId: '0.0.1@123' } as any]);

      jest.spyOn(MirrorNetworkGRPC, 'fromBaseURL').mockReturnValueOnce(MirrorNetworkGRPC.TESTNET);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);

      await expect(service.createTransaction(dto, user as User)).rejects.toThrow(/Transactions already exist/);

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

      const client = Client.forTestnet();

      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
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

      const client = Client.forTestnet();

      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
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
      transactionsRepo.find.mockResolvedValueOnce([]);
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

      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = userKeys;
      });
      jest.spyOn(PublicKey.prototype, 'verify').mockReturnValueOnce(true);
      jest.mocked(isExpired).mockReturnValueOnce(false);
      jest.mocked(isTransactionBodyOverMaxSize).mockReturnValueOnce(true);

      await expect(service.createTransaction(dto, user as User)).rejects.toThrow(ErrorCodes.TOS);

      client.close();
    });

    it('should wrap unexpected errors with annotated BadRequestException', async () => {
      const sdkTransaction = new AccountCreateTransaction().setTransactionId(
        new TransactionId(AccountId.fromString('0.0.1'), Timestamp.fromDate(new Date())),
      );

      const dto: CreateTransactionDto = {
        name: 'Transaction X',
        description: 'Description',
        transactionBytes: Buffer.from(sdkTransaction.toBytes()),
        creatorKeyId: 1,
        signature: Buffer.from('0xabc02'),
        mirrorNetwork: 'testnet',
      };

      // ensure attachKeys populates keys so code reaches the try block
      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = userKeys;
      });

      // return a valid client so the code enters the try block
      const client = Client.forTestnet();
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);

      // make signature & other validators pass so validation does not throw
      jest.spyOn(PublicKey.prototype, 'verify').mockReturnValueOnce(true);
      jest.mocked(isExpired).mockReturnValueOnce(false);
      jest.mocked(isTransactionBodyOverMaxSize).mockReturnValueOnce(false);

      // force an unexpected error inside the try by making the repo check fail
      transactionsRepo.find.mockRejectedValueOnce(new Error('unexpected failure'));

      await expect(service.createTransaction(dto, user as User)).rejects.toThrow(
        'An unexpected error occurred while creating transactions: unexpected failure',
      );

      client.close();
    });

    it('should throw if creator key not found', async () => {
      // prepare a minimal SDK transaction so validate path runs
      const sdkTransaction = new AccountCreateTransaction().setTransactionId(TransactionId.generate('0.0.1'));
      const dto: CreateTransactionDto = {
        mirrorNetwork: 'testnet',
        creatorKeyId: 9999, // id that does not exist on the user
        transactionBytes: sdkTransaction.toBytes(),
        signature: Buffer.from('00'),
        transactionId: sdkTransaction.transactionId.toString(),
      } as any;

      const client = Client.forTestnet();

      // ensure attachKeys leaves the user with no keys so creatorKey is not found
      jest.mocked(attachKeys).mockImplementationOnce(async (usr: User) => {
        usr.keys = [];
      });

      // return a valid client so createTransactions proceeds to validation
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);

      await expect(service.createTransaction(dto as CreateTransactionDto, user as User)).rejects.toThrow(
        `Creator key ${dto.creatorKeyId} not found`,
      );

      client.close();
    });

    it('should extract publicKeys from AccountUpdateTransaction with new key', async () => {
      const newKey = PrivateKey.generateECDSA().publicKey;
      const sdkTransaction = new AccountUpdateTransaction()
        .setTransactionId(new TransactionId(AccountId.fromString('0.0.1'), Timestamp.fromDate(new Date())))
        .setKey(newKey);

      const dto: CreateTransactionDto = {
        name: 'Account Update',
        description: 'Update account key',
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
      transactionsRepo.find.mockResolvedValueOnce([]);
      jest.spyOn(MirrorNetworkGRPC, 'fromBaseURL').mockReturnValueOnce(MirrorNetworkGRPC.TESTNET);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.mocked(getTransactionTypeEnumValue).mockReturnValueOnce(TransactionType.ACCOUNT_UPDATE);
      jest.mocked(flattenKeyList).mockReturnValueOnce([newKey]);

      let capturedTransaction: any;
      transactionsRepo.create.mockImplementationOnce((input: DeepPartial<Transaction>) => {
        capturedTransaction = input;
        return { ...input } as Transaction;
      });

      await service.createTransaction(dto, user as User);

      expect(capturedTransaction.publicKeys).toBeDefined();
      expect(capturedTransaction.publicKeys).toContain(newKey.toStringRaw());
      expect(capturedTransaction.publicKeys).toHaveLength(1);

      client.close();
    });

    it('should extract publicKeys from NodeUpdateTransaction with admin key', async () => {
      const adminKey = PrivateKey.generateECDSA().publicKey;
      const sdkTransaction = new NodeUpdateTransaction()
        .setTransactionId(new TransactionId(AccountId.fromString('0.0.1'), Timestamp.fromDate(new Date())))
        .setAdminKey(adminKey)
        .setNodeId(Long.fromInt(1));

      const dto: CreateTransactionDto = {
        name: 'Node Update',
        description: 'Update node admin key',
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
      transactionsRepo.find.mockResolvedValueOnce([]);
      jest.spyOn(MirrorNetworkGRPC, 'fromBaseURL').mockReturnValueOnce(MirrorNetworkGRPC.TESTNET);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.mocked(getTransactionTypeEnumValue).mockReturnValueOnce(TransactionType.NODE_UPDATE);
      jest.mocked(flattenKeyList).mockReturnValueOnce([adminKey]);

      let capturedTransaction: any;
      transactionsRepo.create.mockImplementationOnce((input: DeepPartial<Transaction>) => {
        capturedTransaction = input;
        return { ...input } as Transaction;
      });

      await service.createTransaction(dto, user as User);

      expect(capturedTransaction.publicKeys).toBeDefined();
      expect(capturedTransaction.publicKeys).toContain(adminKey.toStringRaw());
      expect(capturedTransaction.publicKeys).toHaveLength(1);

      client.close();
    });

    it('should extract publicKeys from NodeCreateTransaction with admin key', async () => {
      const adminKey = PrivateKey.generateECDSA().publicKey;
      const sdkTransaction = new NodeCreateTransaction()
        .setTransactionId(new TransactionId(AccountId.fromString('0.0.1'), Timestamp.fromDate(new Date())))
        .setAdminKey(adminKey)
        .setAccountId(AccountId.fromString('0.0.100'));

      const dto: CreateTransactionDto = {
        name: 'Node Create',
        description: 'Create node with admin key',
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
      transactionsRepo.find.mockResolvedValueOnce([]);
      jest.spyOn(MirrorNetworkGRPC, 'fromBaseURL').mockReturnValueOnce(MirrorNetworkGRPC.TESTNET);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.mocked(getTransactionTypeEnumValue).mockReturnValueOnce(TransactionType.NODE_CREATE);
      jest.mocked(flattenKeyList).mockReturnValueOnce([adminKey]);

      let capturedTransaction: any;
      transactionsRepo.create.mockImplementationOnce((input: DeepPartial<Transaction>) => {
        capturedTransaction = input;
        return { ...input } as Transaction;
      });

      await service.createTransaction(dto, user as User);

      expect(capturedTransaction.publicKeys).toBeDefined();
      expect(capturedTransaction.publicKeys).toContain(adminKey.toStringRaw());
      expect(capturedTransaction.publicKeys).toHaveLength(1);

      client.close();
    });

    it('should set publicKeys to null for transactions without new keys', async () => {
      const sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(new TransactionId(AccountId.fromString('0.0.1'), Timestamp.fromDate(new Date())));

      const dto: CreateTransactionDto = {
        name: 'Transaction without new key',
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
      transactionsRepo.find.mockResolvedValueOnce([]);
      jest.spyOn(MirrorNetworkGRPC, 'fromBaseURL').mockReturnValueOnce(MirrorNetworkGRPC.TESTNET);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.mocked(getTransactionTypeEnumValue).mockReturnValueOnce(TransactionType.ACCOUNT_CREATE);

      let capturedTransaction: any;
      transactionsRepo.create.mockImplementationOnce((input: DeepPartial<Transaction>) => {
        capturedTransaction = input;
        return { ...input } as Transaction;
      });

      await service.createTransaction(dto, user as User);

      expect(capturedTransaction.publicKeys).toBeNull();

      client.close();
    });

    it('should handle key extraction errors gracefully and set publicKeys to null', async () => {
      const sdkTransaction = new AccountUpdateTransaction()
        .setTransactionId(new TransactionId(AccountId.fromString('0.0.1'), Timestamp.fromDate(new Date())))
        .setKey(PrivateKey.generateECDSA().publicKey);

      const dto: CreateTransactionDto = {
        name: 'Account Update',
        description: 'Update with error',
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
      transactionsRepo.find.mockResolvedValueOnce([]);
      jest.spyOn(MirrorNetworkGRPC, 'fromBaseURL').mockReturnValueOnce(MirrorNetworkGRPC.TESTNET);
      jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);
      jest.mocked(getTransactionTypeEnumValue).mockReturnValueOnce(TransactionType.ACCOUNT_UPDATE);

      // Mock console.error to avoid polluting test output
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Force flattenKeyList or key extraction to throw
      jest.spyOn(Object.getPrototypeOf(sdkTransaction), 'key', 'get').mockImplementation(() => {
        throw new Error('Key extraction failed');
      });

      let capturedTransaction: any;
      transactionsRepo.create.mockImplementationOnce((input: DeepPartial<Transaction>) => {
        capturedTransaction = input;
        return { ...input } as Transaction;
      });

      await service.createTransaction(dto, user as User);

      expect(capturedTransaction.publicKeys).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      client.close();
    });
  });

  describe('importSignatures', () => {
    let sdkTransaction: AccountCreateTransaction;

    const transactionId = 3;
    const privateKey = PrivateKey.generateECDSA();

    const userWithKeys = {
      ...user,
      keys: [
        { id: 1, publicKey: privateKey.publicKey.toStringRaw(), mnemonicHash: 'hash' },
      ],
    } as User;

    beforeEach(async () => {
      sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();

      jest.resetAllMocks();
    });

    it('should import signatures successfully', async () => {
      const transaction = {
        id: transactionId,
        transactionId: sdkTransaction.transactionId.toString(),
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        transactionBytes: sdkTransaction.toBytes(),
        mirrorNetwork: 'testnet',
      };
      await sdkTransaction.sign(privateKey);

      entityManager.find.mockResolvedValue([transaction]);
      const executeMock = jest.fn().mockResolvedValue(undefined);
      const qbMock = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        execute: executeMock,
      };
      entityManager.createQueryBuilder.mockReturnValue(qbMock as unknown as any);

      jest.mocked(safe).mockReturnValue({
        data: [privateKey.publicKey],
      });

      // Any value will do here, this just shows the user has access to the transaction
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([1]);

      entityManager.update.mockResolvedValue(undefined);

      const result = await service.importSignatures(
        [{ id: transactionId, signatureMap: sdkTransaction.getSignatures() }],
        userWithKeys
      );

      expect(qbMock.update).toHaveBeenCalledWith(Transaction);
      expect(qbMock.set).toHaveBeenCalledWith({ transactionBytes: expect.any(Function) });
      expect(qbMock.where).toHaveBeenCalledWith('id IN (:...ids)', { ids: expect.any(Array) });
      expect(qbMock.setParameters).toHaveBeenCalledWith(expect.any(Object));
      expect(executeMock).toHaveBeenCalled();

      expect(result).toEqual([{ id: transactionId }]);
      expect(emitTransactionStatusUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        [{
          entityId: transactionId,
          additionalData: {
            transactionId: sdkTransaction.transactionId.toString(),
            network: transaction.mirrorNetwork,
          },
        }],
      );
    });
    
    it('should return error if transaction not found', async () => {
      entityManager.find.mockResolvedValue([]);

      const result = await service.importSignatures(
        [{ id: transactionId, signatureMap: new SignatureMap() }],
        userWithKeys
      );
      expect(result[0].error).toContain(ErrorCodes.TNF);
    });

    it('should return error if transaction status is not valid', async () => {
      const transaction = {
        id: transactionId,
        status: TransactionStatus.CANCELED,
        transactionBytes: sdkTransaction.toBytes(),
        mirrorNetwork: 'testnet',
      };
      await sdkTransaction.sign(privateKey);

      entityManager.find.mockResolvedValue([transaction]);

      const result = await service.importSignatures(
        [{ id: transactionId, signatureMap: sdkTransaction.getSignatures() }],
        userWithKeys
      );
      expect(result[0].error).toContain(ErrorCodes.TNRS);
    });

    it('should return error if transaction is expired', async () => {
      const transaction = {
        id: transactionId,
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        transactionBytes: sdkTransaction.toBytes(),
        mirrorNetwork: 'testnet',
      };
      await sdkTransaction.sign(privateKey);

      entityManager.find.mockResolvedValue([transaction]);

      // Any value will do here, this just shows the user has access to the transaction
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([1]);

      jest.mocked(isExpired).mockReturnValue(true);

      const result = await service.importSignatures(
        [{ id: transactionId, signatureMap: sdkTransaction.getSignatures() }],
        userWithKeys
      );
      expect(result[0]).toMatchObject({
        id: transactionId,
        error: ErrorCodes.TE,
      });
    });

    it('should return error if signature validation fails', async () => {
      const transaction = {
        id: transactionId,
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        transactionBytes: sdkTransaction.toBytes(),
        mirrorNetwork: 'testnet',
      };
      await sdkTransaction.sign(privateKey);
      entityManager.find.mockResolvedValue([transaction]);

      // Any value will do here, this just shows the user has access to the transaction
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([1]);

      jest.mocked(safe).mockImplementationOnce(() => {
        return { error: 'error' };
      });

      const result = await service.importSignatures(
        [{ id: transactionId, signatureMap: sdkTransaction.getSignatures() }],
        userWithKeys
      );
      expect(result[0]).toMatchObject({
        id: transactionId,
        error: ErrorCodes.ISNMPN,
      });
    });

    it('should return error if entityManager.update throws', async () => {
      const transaction = {
        id: transactionId,
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        transactionBytes: sdkTransaction.toBytes(),
        mirrorNetwork: 'testnet',
      };
      await sdkTransaction.sign(privateKey);
      entityManager.find.mockResolvedValue([transaction]);

      // Any value will do here, this just shows the user has access to the transaction
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([1]);

      jest.mocked(safe).mockReturnValue({
        data: [privateKey.publicKey],
      });

      // mock query builder to reject on execute
      const executeMock = jest.fn().mockRejectedValue(new Error('Fail'));
      const qbMock = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        execute: executeMock,
      };
      entityManager.createQueryBuilder.mockReturnValue(qbMock as unknown as any);

      const result = await service.importSignatures(
        [{ id: transactionId, signatureMap: sdkTransaction.getSignatures() }],
        userWithKeys
      );
      expect(executeMock).toHaveBeenCalled();
      expect(result[0]).toMatchObject({
        id: transactionId,
        error: 'An unexpected error occurred while saving the signatures: Fail',
      });
    });

    it('should return error if user does not have verified access', async () => {
      const transaction = {
        id: transactionId,
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        transactionBytes: sdkTransaction.toBytes(),
        mirrorNetwork: 'testnet',
      };
      await sdkTransaction.sign(privateKey);

      entityManager.find.mockResolvedValue([transaction]);

      // force verifyAccess to say the user has no access
      jest.spyOn(service, 'verifyAccess').mockResolvedValueOnce(false);

      const result = await service.importSignatures(
        [{ id: transactionId, signatureMap: sdkTransaction.getSignatures() }],
        userWithKeys,
      );

      expect(result[0]).toMatchObject({
        id: transactionId,
        error: expect.stringContaining(ErrorCodes.TNF),
      });
    });

    it('should return generic error if safe throws unexpectedly', async () => {
      const transaction = {
        id: transactionId,
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        transactionBytes: sdkTransaction.toBytes(),
        mirrorNetwork: 'testnet',
      };
      await sdkTransaction.sign(privateKey);

      entityManager.find.mockResolvedValue([transaction]);

      // user has access
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([1]);

      // simulate unexpected throw from safe()
      jest.mocked(safe).mockImplementationOnce(() => {
        throw new Error('boom');
      });

      const result = await service.importSignatures(
        [{ id: transactionId, signatureMap: sdkTransaction.getSignatures() }],
        userWithKeys,
      );

      expect(result[0]).toMatchObject({
        id: transactionId,
        error: 'An unexpected error occurred while importing the signatures',
      });
    });
  });

// typescript
  describe('verifyAccess', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should throw if no transaction provided', async () => {
      await expect(service.verifyAccess(null, user as User)).rejects.toThrow(ErrorCodes.TNF);
    });

    it('should return true for history/executed statuses', async () => {
      const tx = { status: TransactionStatus.EXECUTED } as Transaction;
      await expect(service.verifyAccess(tx, user as User)).resolves.toBe(true);
    });

    it('should return true if user has keys to sign', async () => {
      const tx = { status: TransactionStatus.WAITING_FOR_SIGNATURES } as Transaction;
      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([1]);
      await expect(service.verifyAccess(tx, user as User)).resolves.toBe(true);
    });

    it('should return true if user is creator', async () => {
      const tx = {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        creatorKey: { userId: user.id },
      } as Transaction;
      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([]);
      await expect(service.verifyAccess(tx, user as User)).resolves.toBe(true);
    });

    it('should return true if user is observer', async () => {
      const tx = {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        observers: [{ userId: user.id }],
      } as Transaction;
      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([]);
      await expect(service.verifyAccess(tx, user as User)).resolves.toBe(true);
    });

    it('should return true if user is signer', async () => {
      const tx = {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        signers: [{ userKey: { userId: user.id } }],
      } as unknown as Transaction;
      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([]);
      await expect(service.verifyAccess(tx, user as User)).resolves.toBe(true);
    });

    it('should return true if user is approver', async () => {
      const tx = {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        approvers: [{ userId: user.id }],
      } as Transaction;
      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([]);
      await expect(service.verifyAccess(tx, user as User)).resolves.toBe(true);
    });

    it('should return false if user has no access', async () => {
      const tx = { status: TransactionStatus.WAITING_FOR_SIGNATURES } as Transaction;
      jest.spyOn(service, 'userKeysToSign').mockResolvedValueOnce([]);
      await expect(service.verifyAccess(tx, user as User)).resolves.toBe(false);
    });
  });

  describe('removeTransaction', () => {
    const transaction = {
      id: 123,
      transactionId: '0.0.12345@1232351234.0123',
      creatorKey: {
        userId: user.id
      },
      mirrorNetwork: 'testnet',
    };

    beforeEach(() => {
      jest.resetAllMocks();
      jest
        .spyOn(service, 'getTransactionForCreator')
        .mockResolvedValueOnce(transaction as Transaction);
    });

    afterEach(() => {
      expect(emitTransactionStatusUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        [{
          entityId: transaction.id,
          additionalData: {
            transactionId: expect.any(String),
            network: transaction.mirrorNetwork,
          },
        }],
      );
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
        transactionId: '0.0.12345@1232351234.0123',
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
      expect(emitTransactionStatusUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        [{
          entityId: transaction.id,
          additionalData: {
            transactionId: expect.any(String),
            network: transaction.mirrorNetwork,
          },
        }],
      );
    });

    it('should emit notification to the notification service', async () => {
      const transaction = {
        id: 123,
        creatorKey: { userId: 1 },
        observers: [{ userId: 2 }],
        signers: [{ userId: 3 }],
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        mirrorNetwork: 'testnet',
        transactionId: '0.0.123@123134145.139840'
      };

      jest
        .spyOn(service, 'getTransactionForCreator')
        .mockResolvedValueOnce(transaction as Transaction);

      await service.cancelTransaction(123, { id: 1 } as User);

      expect(emitTransactionStatusUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        [{
          entityId: transaction.id,
          additionalData: {
            transactionId: transaction.transactionId,
            network: transaction.mirrorNetwork,
          },
        }],
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
        transactionId: '0.0.12345@1232351234.0123',
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
      expect(emitTransactionStatusUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        [{
          entityId: transaction.id,
          additionalData: {
            transactionId: expect.any(String),
            network: transaction.mirrorNetwork,
          },
        }],
      );
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

    it('should emit execute transaction event and return true if transaction.validStart is valid and transaction is manual', async () => {
      const transaction = {
        id: 123,
        creatorKey: { userId: user.id },
        isManual: true,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        transactionBytes: Buffer.from('transactionBytes'),
        mirrorNetwork: 'testnet',
        validStart: new Date(Date.now() - 1000),
      };

      jest
        .spyOn(service, 'getTransactionForCreator')
        .mockResolvedValueOnce(transaction as Transaction);

      const result = await service.executeTransaction(123, user as User);

      expect(result).toBe(true);
      expect(executeService.executeTransaction).toHaveBeenCalledWith(transaction);
    });

    it('should update transaction.isManual to false if transaction is manual and transaction.validStart is not yet valid', async () => {
      const transaction = {
        id: 123,
        creatorKey: { userId: user.id },
        isManual: true,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        transactionBytes: Buffer.from('transactionBytes'),
        mirrorNetwork: 'testnet',
        validStart: new Date(Date.now() + 1000), // future date
      };

      jest
        .spyOn(service, 'getTransactionForCreator')
        .mockResolvedValueOnce(transaction as Transaction);

      const result = await service.executeTransaction(123, user as User);

      expect(result).toBe(true);
      expect(transactionsRepo.update).toHaveBeenCalledWith(
        { id: 123 },
        { isManual: false }
      );
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
      const transaction = {
        id: 123,
        creatorKey: {
          id: 1,
          userId: 1,
          user: {
            id: user.id,
            email: 'test@email.com',
          },
        },
        observers: []
      };

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
        creatorKey: {
          id: 1,
          userId: 1,
          user: {
            id: 1,
            email: 'test@email.com',
          },
        },
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
        creatorKey: {
          id: 1,
          userId: 1,
          user: {
            id: 1,
            email: 'test@email.com',
          },
        },
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
        creatorKey: {
          id: 1,
          userId: 1,
          user: {
            id: 1,
            email: 'test@email.com',
          },
        },
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
        creatorKey: {
          id: 1,
          userId: 2,
          user: {
            id: 2,
            email: 'test@email.com',
          },
        },
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

    it('should return history transaction, even if the user does not have verified access', async () => {
      const transaction = {
        id: 123,
        creatorKey: {
          id: 1,
          userId: 1,
          user: {
            id: 1,
            email: 'test@email.com',
          },
        },
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
        transactionSignatureService,
        entityManager,
        false,
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
