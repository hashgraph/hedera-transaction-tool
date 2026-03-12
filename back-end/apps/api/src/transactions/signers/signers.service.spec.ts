import { Test, TestingModule } from '@nestjs/testing';
import { mock, mockDeep } from 'jest-mock-extended';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { Transaction, TransactionSigner, TransactionStatus, User } from '@entities';

import {
  AccountCreateTransaction,
  PrivateKey,
  SignatureMap,
  AccountId,
  TransactionId,
} from '@hashgraph/sdk';
import {
  emitTransactionStatusUpdate,
  emitTransactionUpdate,
  ErrorCodes,
  NatsPublisherService,
  processTransactionStatus,
  TransactionSignatureService,
} from '@app/common';
import { isExpired } from '@app/common/utils';

import { SignersService } from './signers.service';

jest.mock('@app/common/utils');
jest.mock('@app/common', () => ({
  ...jest.requireActual('@app/common'),
  emitTransactionStatusUpdate: jest.fn(),
  emitTransactionUpdate: jest.fn(),
  processTransactionStatus: jest.fn(),
}));

describe('SignersService', () => {
  let service: SignersService;

  const signersRepo = mockDeep<Repository<TransactionSigner>>();
  const transactionsRepo = mockDeep<Repository<Transaction>>();
  const dataSource = mockDeep<DataSource>();
  const notificationsPublisher = mock<NatsPublisherService>();
  const transactionSignatureService = mock<TransactionSignatureService>();

  const defaultPagination = {
    limit: 10,
    offset: 0,
    page: 1,
    size: 10,
  };
  const user = {
    id: 1,
    keys: [
      { id: 3, publicKey: '61f37fc1bbf3ff4453712ee6a305c5c7255955f7889ec3bf30426f1863158ef4' },
    ],
  } as User;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignersService,
        {
          provide: getRepositoryToken(TransactionSigner),
          useValue: signersRepo,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionsRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: NatsPublisherService,
          useValue: notificationsPublisher,
        },
        {
          provide: TransactionSignatureService,
          useValue: transactionSignatureService,
        },
      ],
    }).compile();

    service = module.get<SignersService>(SignersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSignatureById', () => {
    it('should get signature by id with deleted', async () => {
      const id = 1;
      const signature = new TransactionSigner();
      signersRepo.findOne.mockResolvedValue(signature);

      const result = await service.getSignatureById(id);

      expect(result).toBe(signature);
      expect(signersRepo.findOne).toHaveBeenCalledWith({
        where: { id },
        withDeleted: true,
      });
    });

    it('should return null if id not provided', async () => {
      const result = await service.getSignatureById(null);

      expect(result).toBeNull();
    });
  });

  describe('getSignaturesByUser', () => {
    it('should get signatures by user', async () => {
      signersRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getSignaturesByUser(user, defaultPagination, true);

      expect(signersRepo.findAndCount).toHaveBeenCalledWith({
        where: {
          userId: user.id,
        },
        select: {
          id: true,
          transactionId: true,
          userKeyId: true,
          createdAt: true,
        },
        withDeleted: true,
        skip: defaultPagination.offset,
        take: defaultPagination.limit,
      });

      expect(result).toEqual({
        totalItems: 0,
        items: [],
        page: 1,
        size: 10,
      });
    });

    it('should return null if user not provided', async () => {
      const result = await service.getSignaturesByUser(null, defaultPagination);

      expect(result).toBeNull();
    });
  });

  describe('getSignaturesByTransactionId', () => {
    it('should get signatures by transaction id', async () => {
      const transactionId = 1;
      const signatures = [new TransactionSigner()];
      signersRepo.find.mockResolvedValue(signatures);

      const result = await service.getSignaturesByTransactionId(transactionId, true);

      expect(result).toBe(signatures);
      expect(signersRepo.find).toHaveBeenCalledWith({
        where: {
          transaction: {
            id: transactionId,
          },
        },
        relations: {
          userKey: true,
        },
        withDeleted: true,
      });
    });

    it('should return null if transaction id not provided', async () => {
      const result = await service.getSignaturesByTransactionId(null);

      expect(result).toBeNull();
    });
  });

  describe('loadTransactionData', () => {
    it('should load transactions and existing signers', async () => {
      const dto = [{ id: 1, signatureMap: new SignatureMap() }, { id: 2, signatureMap: new SignatureMap() }];
      const transactions = [
        { id: 1, transactionBytes: Buffer.from([]) },
        { id: 2, transactionBytes: Buffer.from([]) },
      ];
      const existingSigners = [
        { transactionId: 1, userKeyId: 3 },
        { transactionId: 1, userKeyId: 4 },
        { transactionId: 2, userKeyId: 5 },
      ];

      dataSource.manager.find.mockResolvedValueOnce(transactions);
      dataSource.manager.find.mockResolvedValueOnce(existingSigners);

      const result = await service['loadTransactionData'](dto);

      expect(dataSource.manager.find).toHaveBeenNthCalledWith(1, Transaction, {
        where: { id: In([1, 2]) },
      });
      expect(dataSource.manager.find).toHaveBeenNthCalledWith(2, TransactionSigner, {
        where: { transactionId: In([1, 2]) },
        select: ['transactionId', 'userKeyId'],
      });

      expect(result.transactionMap.size).toBe(2);
      expect(result.transactionMap.get(1)).toEqual(transactions[0]);
      expect(result.signersByTransaction.size).toBe(2);
      expect(result.signersByTransaction.get(1)).toEqual(new Set([3, 4]));
      expect(result.signersByTransaction.get(2)).toEqual(new Set([5]));
    });

    it('should handle empty results', async () => {
      const dto = [{ id: 1, signatureMap: new SignatureMap() }];

      dataSource.manager.find.mockResolvedValueOnce([]);
      dataSource.manager.find.mockResolvedValueOnce([]);

      const result = await service['loadTransactionData'](dto);

      expect(result.transactionMap.size).toBe(0);
      expect(result.signersByTransaction.size).toBe(0);
    });
  });

  describe('validateTransactionStatus', () => {
    it('should return null for valid transaction', () => {
      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: 1,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      } as Transaction;

      jest.mocked(isExpired).mockReturnValue(false);

      const result = service['validateTransactionStatus'](transaction);

      expect(result).toBeNull();
    });

    it('should return error for canceled transaction', () => {
      const transaction = {
        id: 1,
        status: TransactionStatus.CANCELED,
      } as Transaction;

      const result = service['validateTransactionStatus'](transaction);

      expect(result).toBe(ErrorCodes.TNRS);
    });

    it('should return error for expired transaction', () => {
      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: 1,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      } as Transaction;

      jest.mocked(isExpired).mockReturnValue(true);

      const result = service['validateTransactionStatus'](transaction);

      expect(result).toBe(ErrorCodes.TE);
    });
  });

  describe('processTransactionSignatures', () => {
    it('should process signatures and return updated transaction', async () => {
      const privateKey = PrivateKey.generateECDSA();
      const userKeyMap = new Map<string, any>();
      userKeyMap.set(privateKey.publicKey.toStringRaw(), { id: 3, publicKey: privateKey.publicKey.toStringRaw() });

      const sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();

      const transaction = {
        id: 1,
        transactionBytes: sdkTransaction.toBytes(),
      } as Transaction;

      await sdkTransaction.sign(privateKey);
      const signatureMap = sdkTransaction.getSignatures();

      const result = await service['processTransactionSignatures'](
        transaction,
        signatureMap,
        userKeyMap,
        new Set()
      );

      expect(result.userKeys).toHaveLength(1);
      expect(result.userKeys[0].id).toBe(3);
      expect(result.isSameBytes).toBe(false);
    });

    it('should throw error if public key does not belong to user', async () => {
      const privateKey = PrivateKey.generateECDSA();
      const userKeyMap = new Map<string, any>();
      // User key map is empty - no matching keys

      const sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();

      const transaction = {
        id: 1,
        transactionBytes: sdkTransaction.toBytes(),
      } as Transaction;

      await sdkTransaction.sign(privateKey);
      const signatureMap = sdkTransaction.getSignatures();

      await expect(
        service['processTransactionSignatures'](
          transaction,
          signatureMap,
          userKeyMap,
          new Set()
        )
      ).rejects.toThrow(ErrorCodes.PNY);
    });

    it('should not include existing signers in userKeys', async () => {
      const privateKey = PrivateKey.generateECDSA();
      const userKeyMap = new Map<string, any>();
      userKeyMap.set(privateKey.publicKey.toStringRaw(), { id: 3, publicKey: privateKey.publicKey.toStringRaw() });

      const sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();

      const transaction = {
        id: 1,
        transactionBytes: sdkTransaction.toBytes(),
      } as Transaction;

      await sdkTransaction.sign(privateKey);
      const signatureMap = sdkTransaction.getSignatures();

      const existingSignerIds = new Set([3]); // Already signed

      const result = await service['processTransactionSignatures'](
        transaction,
        signatureMap,
        userKeyMap,
        existingSignerIds
      );

      expect(result.userKeys).toHaveLength(0); // Should not include existing signer
    });

    it('should detect when transaction bytes are the same', async () => {
      const privateKey = PrivateKey.generateECDSA();
      const userKeyMap = new Map<string, any>();
      userKeyMap.set(privateKey.publicKey.toStringRaw(), { id: 3, publicKey: privateKey.publicKey.toStringRaw() });

      const sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();

      await sdkTransaction.sign(privateKey);

      const transaction = {
        id: 1,
        transactionBytes: sdkTransaction.toBytes(), // Already has signature
      } as Transaction;

      const signatureMap = sdkTransaction.getSignatures();

      const result = await service['processTransactionSignatures'](
        transaction,
        signatureMap,
        userKeyMap,
        new Set()
      );

      expect(result.isSameBytes).toBe(true);
    });
  });

  describe('bulkUpdateTransactions', () => {
    it('should execute bulk transaction update query', async () => {
      const mockManager = mockDeep<any>();
      mockManager.query.mockResolvedValue(undefined);

      const transactionsToUpdate = [
        { id: 1, transactionBytes: Buffer.from([1, 2, 3]) },
        { id: 2, transactionBytes: Buffer.from([4, 5, 6]) },
      ];

      await service['bulkUpdateTransactions'](mockManager, transactionsToUpdate);

      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE transaction'),
        expect.arrayContaining([
          Buffer.from([1, 2, 3]),
          Buffer.from([4, 5, 6]),
          [1, 2],
        ])
      );
    });
  });

  describe('bulkUpdateNotificationReceivers', () => {
    it('should execute bulk notification update query', async () => {
      const mockManager = mockDeep<any>();
      mockManager.query.mockResolvedValue([[{ id: 1, userId: 1 }, { id: 2, userId: 2 }], 2]);

      const notificationsToUpdate = [
        { userId: 1, transactionId: 100 },
        { userId: 2, transactionId: 200 },
      ];

      await service['bulkUpdateNotificationReceivers'](mockManager, notificationsToUpdate);

      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notification_receiver'),
        [[1, 2], [100, 200]],
      );
    });

    it('should not execute query when notificationsToUpdate is empty', async () => {
      const mockManager = mockDeep<any>();

      await service['bulkUpdateNotificationReceivers'](mockManager, []);

      expect(mockManager.query).not.toHaveBeenCalled();
    });

    it('should build correct query with UNNEST and paired arrays', async () => {
      const mockManager = mockDeep<any>();
      mockManager.query.mockResolvedValue([[{ id: 1, userId: 42 }], 1]);

      const notificationsToUpdate = [{ userId: 42, transactionId: 99 }];

      await service['bulkUpdateNotificationReceivers'](mockManager, notificationsToUpdate);

      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('UNNEST($1::int[], $2::int[])'),
        [[42], [99]],
      );
      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining("type = 'TRANSACTION_INDICATOR_SIGN'"),
        expect.any(Array),
      );
      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('isRead" = false'),
        expect.any(Array),
      );
    });

    it('should return only the rows, not the rowCount', async () => {
      const mockManager = mockDeep<any>();
      const mockRows = [{ id: 1, userId: 42 }];
      mockManager.query.mockResolvedValue([mockRows, 1]);

      const result = await service['bulkUpdateNotificationReceivers'](
        mockManager,
        [{ userId: 42, transactionId: 99 }],
      );

      expect(result).toEqual(mockRows);
    });

    it('should return empty array when no rows updated', async () => {
      const mockManager = mockDeep<any>();
      mockManager.query.mockResolvedValue([[], 0]);

      const result = await service['bulkUpdateNotificationReceivers'](
        mockManager,
        [{ userId: 42, transactionId: 99 }],
      );

      expect(result).toEqual([]);
    });
  });

  describe('bulkInsertSigners', () => {
    it('should execute bulk insert and return raw results', async () => {
      const mockManager = mockDeep<any>();
      const mockRaw = [
        { id: 1, userId: 1, transactionId: 1, userKeyId: 3 },
      ];
      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: mockRaw }),
      };
      mockManager.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const signersToInsert = [{ userId: 1, transactionId: 1, userKeyId: 3 }];

      const result = await service['bulkInsertSigners'](mockManager, signersToInsert);

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(mockQueryBuilder.into).toHaveBeenCalledWith(TransactionSigner);
      expect(mockQueryBuilder.values).toHaveBeenCalledWith(signersToInsert);
      expect(mockQueryBuilder.returning).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
      expect(result).toEqual(mockRaw);
    });
  });

  describe('updateStatusesAndNotify', () => {
    it('should process statuses and emit notifications for new statuses', async () => {
      const transactionsToProcess = [
        { id: 1, transaction: { id: 1 } as Transaction },
        { id: 2, transaction: { id: 2 } as Transaction },
      ];

      const statusMap = new Map<number, TransactionStatus>();
      statusMap.set(1, TransactionStatus.WAITING_FOR_EXECUTION);
      statusMap.set(2, TransactionStatus.WAITING_FOR_EXECUTION);

      jest.mocked(processTransactionStatus).mockResolvedValue(statusMap);

      await service['updateStatusesAndNotify'](transactionsToProcess);

      expect(processTransactionStatus).toHaveBeenCalledWith(
        transactionsRepo,
        transactionSignatureService,
        [transactionsToProcess[0].transaction, transactionsToProcess[1].transaction]
      );
      expect(emitTransactionStatusUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        [{ entityId: 1 }, { entityId: 2 }]
      );
      expect(emitTransactionUpdate).not.toHaveBeenCalled();
    });

    it('should emit transaction update for unchanged statuses', async () => {
      const transactionsToProcess = [
        { id: 1, transaction: { id: 1 } as Transaction },
      ];

      const statusMap = new Map<number, TransactionStatus>(); // Empty - no status changes

      jest.mocked(processTransactionStatus).mockResolvedValue(statusMap);

      await service['updateStatusesAndNotify'](transactionsToProcess);

      expect(emitTransactionStatusUpdate).not.toHaveBeenCalled();
      expect(emitTransactionUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        [{ entityId: 1 }]
      );
    });

    it('should handle empty transactions list', async () => {
      await service['updateStatusesAndNotify']([]);

      expect(processTransactionStatus).not.toHaveBeenCalled();
      expect(emitTransactionStatusUpdate).not.toHaveBeenCalled();
      expect(emitTransactionUpdate).not.toHaveBeenCalled();
    });

    it('should handle status processing errors gracefully', async () => {
      const transactionsToProcess = [
        { id: 1, transaction: { id: 1 } as Transaction },
      ];

      jest.mocked(processTransactionStatus).mockRejectedValue(new Error('Status error'));

      await service['updateStatusesAndNotify'](transactionsToProcess);

      // Should treat all as unchanged when error occurs
      expect(emitTransactionUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        [{ entityId: 1 }]
      );
    });
  });

  describe('uploadSignatureMaps - integration', () => {
    it('should upload signatures and update transaction bytes', async () => {
      const transactionId = 3;
      const originalPublicKey = user.keys[0].publicKey;
      const publicKeyId = user.keys[0].id;
      const privateKey = PrivateKey.generateECDSA();
      user.keys[0].publicKey = privateKey.publicKey.toStringRaw();

      const sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();

      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        mirrorNetwork: 'testnet',
      };

      await sdkTransaction.sign(privateKey);

      dataSource.manager.find.mockResolvedValueOnce([transaction]);
      dataSource.manager.find.mockResolvedValueOnce([]);

      jest.mocked(isExpired).mockReturnValue(false);

      const mockRaw = [{ id: 1, userId: user.id, transactionId, userKeyId: publicKeyId }];
      const mockManager = mockDeep<any>();
      mockManager.query
        .mockResolvedValueOnce(undefined)        // bulkUpdateTransactions
        .mockResolvedValueOnce([[], 0]);          // bulkUpdateNotificationReceivers
      mockManager.createQueryBuilder.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: mockRaw }),
      });

      (dataSource.transaction as jest.Mock).mockImplementation(async (arg1: any, arg2?: any) => {
        const callback = typeof arg1 === 'function' ? arg1 : arg2;
        return callback(mockManager);
      });

      const statusMap = new Map<number, TransactionStatus>();
      statusMap.set(transactionId, TransactionStatus.WAITING_FOR_EXECUTION);
      jest.mocked(processTransactionStatus).mockResolvedValue(statusMap);

      const result = await service.uploadSignatureMaps(
        [{ id: transactionId, signatureMap: sdkTransaction.getSignatures() }],
        user,
      );

      expect(dataSource.manager.find).toHaveBeenCalledWith(Transaction, {
        where: { id: In([transactionId]) },
      });
      expect(mockManager.query).toHaveBeenCalled();
      expect(emitTransactionStatusUpdate).toHaveBeenCalledWith(notificationsPublisher, [
        { entityId: transactionId },
      ]);
      expect(result.signers).toHaveLength(1);
      expect(result.notificationReceiverIds).toEqual([]);

      user.keys[0].publicKey = originalPublicKey;
    });

    it('should handle multiple transactions in batch', async () => {
      const transactionId1 = 1;
      const transactionId2 = 2;
      const originalPublicKey = user.keys[0].publicKey;
      const privateKey = PrivateKey.generateECDSA();
      user.keys[0].publicKey = privateKey.publicKey.toStringRaw();

      const sdkTransaction1 = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();

      const sdkTransaction2 = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();

      const transactions = [
        { id: transactionId1, transactionBytes: sdkTransaction1.toBytes(), status: TransactionStatus.WAITING_FOR_EXECUTION },
        { id: transactionId2, transactionBytes: sdkTransaction2.toBytes(), status: TransactionStatus.WAITING_FOR_EXECUTION },
      ];

      await sdkTransaction1.sign(privateKey);
      await sdkTransaction2.sign(privateKey);

      dataSource.manager.find.mockResolvedValueOnce(transactions);
      dataSource.manager.find.mockResolvedValueOnce([]);

      jest.mocked(isExpired).mockReturnValue(false);

      const mockManager = mockDeep<any>();
      mockManager.query
        .mockResolvedValueOnce(undefined)        // bulkUpdateTransactions
        .mockResolvedValueOnce([[], 0]);          // bulkUpdateNotificationReceivers
      mockManager.createQueryBuilder.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: [] }),
      });

      (dataSource.transaction as jest.Mock).mockImplementation(async (arg1: any, arg2?: any) => {
        const callback = typeof arg1 === 'function' ? arg1 : arg2;
        return callback(mockManager);
      });

      const statusMap = new Map<number, TransactionStatus>();
      statusMap.set(transactionId1, TransactionStatus.WAITING_FOR_EXECUTION);
      statusMap.set(transactionId2, TransactionStatus.WAITING_FOR_EXECUTION);
      jest.mocked(processTransactionStatus).mockResolvedValue(statusMap);

      const result = await service.uploadSignatureMaps(
        [
          { id: transactionId1, signatureMap: sdkTransaction1.getSignatures() },
          { id: transactionId2, signatureMap: sdkTransaction2.getSignatures() },
        ],
        user,
      );

      expect(dataSource.manager.find).toHaveBeenCalledWith(Transaction, {
        where: { id: In([transactionId1, transactionId2]) },
      });
      expect(emitTransactionStatusUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        expect.arrayContaining([{ entityId: transactionId1 }, { entityId: transactionId2 }]),
      );
      expect(result.signers).toBeDefined();
      expect(result.notificationReceiverIds).toEqual([]);

      user.keys[0].publicKey = originalPublicKey;
    });

    it('should skip transaction if nothing changed', async () => {
      const transactionId = 3;
      const originalPublicKey = user.keys[0].publicKey;
      const publicKeyId = user.keys[0].id;
      const privateKey = PrivateKey.generateECDSA();
      user.keys[0].publicKey = privateKey.publicKey.toStringRaw();

      const sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();

      await sdkTransaction.sign(privateKey);

      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        mirrorNetwork: 'testnet',
      };

      dataSource.manager.find.mockResolvedValueOnce([transaction]);
      dataSource.manager.find.mockResolvedValueOnce([
        { id: 1, transactionId, userKeyId: publicKeyId },
      ]);

      jest.mocked(isExpired).mockReturnValue(false);

      const mockManager = mockDeep<any>();
      (dataSource.transaction as jest.Mock).mockImplementation(async (arg1: any, arg2?: any) => {
        const callback = typeof arg1 === 'function' ? arg1 : arg2;
        return callback(mockManager);
      });

      jest.mocked(processTransactionStatus).mockResolvedValue(new Map());

      const result = await service.uploadSignatureMaps(
        [{ id: transactionId, signatureMap: sdkTransaction.getSignatures() }],
        user,
      );

      expect(mockManager.query).not.toHaveBeenCalled();
      expect(mockManager.createQueryBuilder).not.toHaveBeenCalled();
      expect(emitTransactionStatusUpdate).not.toHaveBeenCalled();
      expect(emitTransactionUpdate).not.toHaveBeenCalled();
      expect(result.signers).toHaveLength(0);
      expect(result.notificationReceiverIds).toEqual([]);

      user.keys[0].publicKey = originalPublicKey;
    });

    it('should return notificationReceiverIds when notifications are dismissed', async () => {
      const transactionId = 3;
      const originalPublicKey = user.keys[0].publicKey;
      const privateKey = PrivateKey.generateECDSA();
      user.keys[0].publicKey = privateKey.publicKey.toStringRaw();

      const sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();

      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      await sdkTransaction.sign(privateKey);

      dataSource.manager.find.mockResolvedValueOnce([transaction]);
      dataSource.manager.find.mockResolvedValueOnce([]);

      jest.mocked(isExpired).mockReturnValue(false);

      const mockNotificationRows = [{ id: 10, userId: user.id }, { id: 11, userId: user.id }];
      const mockManager = mockDeep<any>();
      mockManager.query
        .mockResolvedValueOnce(undefined)                        // bulkUpdateTransactions
        .mockResolvedValueOnce([mockNotificationRows, 2]);       // bulkUpdateNotificationReceivers
      mockManager.createQueryBuilder.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: [] }),
      });

      (dataSource.transaction as jest.Mock).mockImplementation(async (arg1: any, arg2?: any) => {
        const callback = typeof arg1 === 'function' ? arg1 : arg2;
        return callback(mockManager);
      });

      jest.mocked(processTransactionStatus).mockResolvedValue(new Map());

      const result = await service.uploadSignatureMaps(
        [{ id: transactionId, signatureMap: sdkTransaction.getSignatures() }],
        user,
      );

      expect(result.notificationReceiverIds).toEqual([10, 11]);

      user.keys[0].publicKey = originalPublicKey;
    });

    it('should handle database transaction failure', async () => {
      const transactionId = 3;
      const originalPublicKey = user.keys[0].publicKey;
      const privateKey = PrivateKey.generateECDSA();
      user.keys[0].publicKey = privateKey.publicKey.toStringRaw();

      const sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();

      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      await sdkTransaction.sign(privateKey);

      dataSource.manager.find.mockResolvedValueOnce([transaction]);
      dataSource.manager.find.mockResolvedValueOnce([]);

      jest.mocked(isExpired).mockReturnValue(false);

      (dataSource.transaction as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        service.uploadSignatureMaps(
          [{ id: transactionId, signatureMap: sdkTransaction.getSignatures() }],
          user,
        ),
      ).rejects.toThrow(ErrorCodes.FST);

      expect(emitTransactionStatusUpdate).not.toHaveBeenCalled();

      user.keys[0].publicKey = originalPublicKey;
    });

    it('logs and skips transaction when processTransactionSignatures throws', async () => {
      const transactionId = 99;
      const sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();

      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
      } as Transaction;

      dataSource.manager.find.mockResolvedValueOnce([transaction]);
      dataSource.manager.find.mockResolvedValueOnce([]);

      jest.mocked(isExpired).mockReturnValue(false);

      const mockManager = mockDeep<any>();
      mockManager.query = jest.fn()
        .mockResolvedValueOnce(undefined)   // bulkUpdateTransactions
        .mockResolvedValueOnce([[], 0]);    // bulkUpdateNotificationReceivers
      mockManager.createQueryBuilder = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: [] }),
      });
      (dataSource.transaction as jest.Mock).mockImplementation(async (arg1: any, arg2?: any) => {
        const callback = typeof arg1 === 'function' ? arg1 : arg2;
        return callback(mockManager);
      });

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const procSpy = jest
        .spyOn(service as any, 'processTransactionSignatures')
        .mockRejectedValueOnce(new Error('Fail'));

      const result = await service.uploadSignatureMaps(
        [{ id: transactionId, signatureMap: new SignatureMap() }],
        user,
      );

      expect(consoleError).toHaveBeenCalledWith(`[TX ${transactionId}] Error:`, 'Fail');
      expect(result.signers).toHaveLength(0);
      expect(result.notificationReceiverIds).toEqual([]);

      procSpy.mockRestore();
      consoleError.mockRestore();
    });

    it('logs and skips when validation returns transaction-not-found', async () => {
      const transactionId = 42;

      dataSource.manager.find.mockResolvedValueOnce([]);
      dataSource.manager.find.mockResolvedValueOnce([]);

      const mockManager = mockDeep<any>();
      mockManager.query = jest.fn()
        .mockResolvedValueOnce(undefined)   // bulkUpdateTransactions
        .mockResolvedValueOnce([[], 0]);    // bulkUpdateNotificationReceivers
      mockManager.createQueryBuilder = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: [] }),
      });
      (dataSource.transaction as jest.Mock).mockImplementation(async (arg1: any, arg2?: any) => {
        const callback = typeof arg1 === 'function' ? arg1 : arg2;
        return callback(mockManager);
      });

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.uploadSignatureMaps(
        [{ id: transactionId, signatureMap: new SignatureMap() }],
        user,
      );

      expect(consoleError).toHaveBeenCalledWith(
        `[TX ${transactionId}] Validation failed: ${ErrorCodes.TNF}`,
      );
      expect(result.signers).toHaveLength(0);
      expect(result.notificationReceiverIds).toEqual([]);

      consoleError.mockRestore();
    });

    it('logs and skips when transaction status is invalid', async () => {
      const transactionId = 55;
      const transaction = {
        id: transactionId,
        transactionBytes: Buffer.from([]),
        status: TransactionStatus.CANCELED,
      } as Transaction;

      dataSource.manager.find.mockResolvedValueOnce([transaction]);
      dataSource.manager.find.mockResolvedValueOnce([]);

      const mockManager = mockDeep<any>();
      mockManager.query = jest.fn()
        .mockResolvedValueOnce(undefined)   // bulkUpdateTransactions
        .mockResolvedValueOnce([[], 0]);    // bulkUpdateNotificationReceivers
      mockManager.createQueryBuilder = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: [] }),
      });
      (dataSource.transaction as jest.Mock).mockImplementation(async (arg1: any, arg2?: any) => {
        const callback = typeof arg1 === 'function' ? arg1 : arg2;
        return callback(mockManager);
      });

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.uploadSignatureMaps(
        [{ id: transactionId, signatureMap: new SignatureMap() }],
        user,
      );

      expect(consoleError).toHaveBeenCalledWith(
        `[TX ${transactionId}] Validation failed: ${ErrorCodes.TNRS}`,
      );
      expect(result.signers).toHaveLength(0);
      expect(result.notificationReceiverIds).toEqual([]);

      consoleError.mockRestore();
    });
  });
});
