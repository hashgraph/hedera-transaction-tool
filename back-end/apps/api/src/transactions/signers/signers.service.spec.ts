import { Test, TestingModule } from '@nestjs/testing';
import { mock, mockDeep } from 'jest-mock-extended';
import { ClientProxy } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';

import { Transaction, TransactionSigner, TransactionStatus, User } from '@entities';

import {
  AccountCreateTransaction,
  PrivateKey,
  SignatureMap,
  AccountId,
  TransactionId,
} from '@hashgraph/sdk';
import { CHAIN_SERVICE, ErrorCodes, MirrorNodeService, NOTIFICATIONS_SERVICE } from '@app/common';
import {
  emitUpdateTransactionStatus,
  isExpired,
  userKeysRequiredToSign,
  notifyTransactionAction,
  notifySyncIndicators,
  safe,
} from '@app/common/utils';

import { SignersService } from './signers.service';

jest.mock('@app/common/utils');

const expectNotifyNotCalled = () => {
  expect(notifyTransactionAction).not.toHaveBeenCalled();
  expect(notifySyncIndicators).not.toHaveBeenCalled();
};

describe('SignaturesService', () => {
  let service: SignersService;

  const signersRepo = mockDeep<Repository<TransactionSigner>>();
  const dataSource = mockDeep<DataSource>();
  const chainService = mock<ClientProxy>();
  const notificationService = mock<ClientProxy>();
  const mirrorNodeService = mock<MirrorNodeService>();

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignersService,
        {
          provide: getRepositoryToken(TransactionSigner),
          useValue: signersRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: CHAIN_SERVICE,
          useValue: chainService,
        },
        {
          provide: NOTIFICATIONS_SERVICE,
          useValue: notificationService,
        },
        {
          provide: MirrorNodeService,
          useValue: mirrorNodeService,
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
    beforeEach(() => {
      jest.resetAllMocks();
    });

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

  const signatureMap = new SignatureMap();

  describe('uploadSignatureMap', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should upload signature', async () => {
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
      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(safe).mockReturnValue({ data: [privateKey.publicKey] });
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);

      const queryRunner = mockDeep<QueryRunner>();
      dataSource.createQueryRunner.mockReturnValueOnce(queryRunner);

      await service.uploadSignatureMaps(
        [{ transactionId, signatureMap: sdkTransaction.getSignatures() }],
        user,
      );

      expect(dataSource.manager.update).toHaveBeenCalledWith(
        Transaction,
        { id: transactionId },
        expect.anything(),
      );
      expect(signersRepo.create).toHaveBeenCalledWith({
        user,
        transaction,
        userKey: user.keys[0],
      });

      expect(emitUpdateTransactionStatus).toHaveBeenCalledWith(chainService, transactionId);
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationService,
        transactionId,
        transaction.status,
        { network: transaction.mirrorNetwork },
      );

      user.keys[0].publicKey = originalPublicKey;
    });

    it('should upload signature, but not update transaction bytes if no change', async () => {
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

      dataSource.manager.findOneBy
        .mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(safe).mockReturnValue({ data: [privateKey.publicKey] });
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);

      const queryRunner = mockDeep<QueryRunner>();
      dataSource.createQueryRunner.mockReturnValueOnce(queryRunner);

      await service.uploadSignatureMaps(
        [{ transactionId, signatureMap: sdkTransaction.getSignatures() }],
        user,
      );

      expect(dataSource.manager.update).not.toHaveBeenCalled();
      expect(signersRepo.create).toHaveBeenCalledWith({
        user,
        transaction,
        userKey: user.keys[0],
      });

      expect(emitUpdateTransactionStatus).toHaveBeenCalledWith(chainService, transactionId);
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationService,
        transactionId,
        transaction.status,
        { network: transaction.mirrorNetwork },
      );

      user.keys[0].publicKey = originalPublicKey;
    });

    it('should update transaction bytes, but not upload signature if it already exists', async () => {
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
      const signer = {
        id: 1,
        transactionId,
        userKeyId: publicKeyId,
      }

      dataSource.manager.findOneBy
        .mockResolvedValueOnce(transaction)
        .mockResolvedValueOnce(signer);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(safe).mockReturnValue({ data: [privateKey.publicKey] });
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);

      const queryRunner = mockDeep<QueryRunner>();
      dataSource.createQueryRunner.mockReturnValueOnce(queryRunner);

      await service.uploadSignatureMaps(
        [{ transactionId, signatureMap: sdkTransaction.getSignatures() }],
        user,
      );

      expect(dataSource.manager.update).toHaveBeenCalledWith(
        Transaction,
        { id: transactionId },
        expect.anything(),
      );

      expect(signersRepo.create).not.toHaveBeenCalled();
      expect(emitUpdateTransactionStatus).toHaveBeenCalledWith(chainService, transactionId);
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationService,
        transactionId,
        transaction.status,
        { network: transaction.mirrorNetwork },
      );

      user.keys[0].publicKey = originalPublicKey;
    });

    it('should ignore signature if it already exists', async () => {
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
      const signer = {
        id: 1,
        transactionId,
        userKeyId: publicKeyId,
      }

      dataSource.manager.findOneBy
        .mockResolvedValueOnce(transaction)
        .mockResolvedValueOnce(signer);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(safe).mockReturnValue({ data: [privateKey.publicKey] });
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);

      const queryRunner = mockDeep<QueryRunner>();
      dataSource.createQueryRunner.mockReturnValueOnce(queryRunner);

      await service.uploadSignatureMaps(
        [{ transactionId, signatureMap: sdkTransaction.getSignatures() }],
        user,
      );

      expect(dataSource.manager.update).not.toHaveBeenCalled();
      expect(signersRepo.create).not.toHaveBeenCalled();
      expect(emitUpdateTransactionStatus).not.toHaveBeenCalled();
      expect(notifyTransactionAction).not.toHaveBeenCalled();
      expect(notifySyncIndicators).not.toHaveBeenCalled();

      user.keys[0].publicKey = originalPublicKey;
    });

    it('should throw if signature public key does not belong to sender', async () => {
      const transactionId = 3;
      const publicKey = PrivateKey.generate().publicKey;

      const sdkTransaction = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate('0.0.2'))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(safe).mockReturnValue({ data: [publicKey] });
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([2]);

      await expect(
        service.uploadSignatureMaps([{ transactionId, signatureMap }], user),
      ).rejects.toThrow(ErrorCodes.PNY);
      expectNotifyNotCalled();
    });

    it('should throw if transaction is not found', async () => {
      const transactionId = 3;

      dataSource.manager.findOneBy.mockResolvedValueOnce(null);

      await expect(
        service.uploadSignatureMaps([{ transactionId, signatureMap }], user),
      ).rejects.toThrow(ErrorCodes.TNF);
      expectNotifyNotCalled();
    });

    it('should throw if transaction is expired', async () => {
      const transactionId = 3;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(true);

      await expect(
        service.uploadSignatureMaps([{ transactionId, signatureMap }], user),
      ).rejects.toThrow(ErrorCodes.TE);
      expectNotifyNotCalled();
    });

    it('should throw if transaction is canceled', async () => {
      const transactionId = 3;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.CANCELED,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);

      await expect(
        service.uploadSignatureMaps([{ transactionId, signatureMap }], user),
      ).rejects.toThrow(ErrorCodes.TNRS);
      expectNotifyNotCalled();
    });

    it('should throw if some signature is invalid', async () => {
      const transactionId = 3;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(safe).mockImplementationOnce(() => {
        return { error: 'error' };
      });

      await expect(
        service.uploadSignatureMaps([{ transactionId, signatureMap }], user),
      ).rejects.toThrow(ErrorCodes.ISNMPN);
      expectNotifyNotCalled();
    });

    it('should throw if the database update fails', async () => {
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
      };

      await sdkTransaction.sign(privateKey);
      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(safe).mockReturnValue({ data: [privateKey.publicKey] });
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);

      dataSource.manager.update.mockRejectedValueOnce(new Error());

      const queryRunner = mock<QueryRunner>();
      dataSource.createQueryRunner.mockReturnValueOnce(queryRunner);

      await expect(
        service.uploadSignatureMaps(
          [{
            transactionId,
            signatureMap: sdkTransaction.getSignatures()
          }],
          user,
        ),
      ).rejects.toThrow(ErrorCodes.FST);
      expectNotifyNotCalled();

      user.keys[0].publicKey = originalPublicKey;
    });
  });
});
