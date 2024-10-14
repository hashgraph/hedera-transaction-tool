import { Test, TestingModule } from '@nestjs/testing';
import { mock, mockDeep } from 'jest-mock-extended';
import { ClientProxy } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';

import { Transaction, TransactionSigner, TransactionStatus, User } from '@entities';

import { AccountCreateTransaction } from '@hashgraph/sdk';
import { CHAIN_SERVICE, MirrorNodeService, NOTIFICATIONS_SERVICE } from '@app/common';
import {
  addTransactionSignatures,
  isAlreadySigned,
  isExpired,
  validateSignature,
  userKeysRequiredToSign,
  notifyTransactionAction,
  notifySyncIndicators,
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
          user: {
            id: user.id,
          },
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

  const signatures = {
    '0.0.3': Buffer.from(
      '0xac244c7240650eaa32b60fd4d7d2ef9f49d3bcd1e3ae1df273ede1b4da32f32b25e389d5a8195b6efbc39ac62810348688976c5304fbef33e51cd7505592cd0f',
      'hex',
    ),
    '0.0.5': Buffer.from(
      '0x053bc5e784dc767095fbdafaaefed3553dd384b86877276951c7eb634d1f0191288a2cc72e6477a1661a483a38935ab51297ec84555c1d0bcb68daf77fb49a0b',
      'hex',
    ),
    '0.0.7': Buffer.from(
      '0xccad395302df6b0ea31d15d9ab9c58bc5a6dc6ec9a334dbfb09c321e6fba802bf8873ba03e3e81d80e499d56a318f663d897aff78cedeb1b7a3d43bdf4609a08',
      'hex',
    ),
  };

  describe('uploadSignature', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should upload signature', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(true);
      jest.mocked(isAlreadySigned).mockReturnValue(false);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);
      jest.mocked(addTransactionSignatures).mockImplementationOnce(jest.fn());

      const queryRunner = mock<QueryRunner>();
      dataSource.createQueryRunner.mockReturnValueOnce(queryRunner);

      await service.uploadSignature(transactionId, { publicKeyId, signatures }, user);

      expect(validateSignature).toHaveBeenCalledTimes(Object.entries(signatures).length);
      expect(isAlreadySigned).toHaveBeenCalledWith(expect.anything(), user.keys[0].publicKey);
      expect(userKeysRequiredToSign).toHaveBeenCalledWith(
        transaction,
        user,
        mirrorNodeService,
        dataSource.manager,
      );
      expect(addTransactionSignatures).toHaveBeenCalledWith(
        expect.anything(),
        signatures,
        user.keys[0].publicKey,
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
      expect(signersRepo.save).toHaveBeenCalled();

      expect(chainService.emit).toHaveBeenCalledWith('update-transaction-status', {
        id: transactionId,
      });
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationService,
        transactionId,
        transaction.status,
      );
    });

    it.skip('should throw if signature public key does not belong to sender', async () => {
      const transactionId = 3;
      const publicKeyId = 34234;

      await expect(
        service.uploadSignature(transactionId, { publicKeyId, signatures }, user),
      ).rejects.toThrow('Transaction can be signed only with your own key');
      expectNotifyNotCalled();
    });

    it('should throw if transaction is not found', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      dataSource.manager.findOneBy.mockResolvedValueOnce(null);

      await expect(
        service.uploadSignature(transactionId, { publicKeyId, signatures }, user),
      ).rejects.toThrow('Transaction not found');
      expectNotifyNotCalled();
    });

    it('should throw if transaction is expired', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(true);

      await expect(
        service.uploadSignature(transactionId, { publicKeyId, signatures }, user),
      ).rejects.toThrow('Transaction is expired');
      expectNotifyNotCalled();
    });

    it('should throw if transaction is canceled', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.CANCELED,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);

      await expect(
        service.uploadSignature(transactionId, { publicKeyId, signatures }, user),
      ).rejects.toThrow('Transaction has been canceled');
      expectNotifyNotCalled();
    });

    it('should throw if some signature is invalid', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(false);

      await expect(
        service.uploadSignature(transactionId, { publicKeyId, signatures }, user),
      ).rejects.toThrow();
      expectNotifyNotCalled();
    });

    it('should throw if transaction is already signed', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(true);
      jest.mocked(isAlreadySigned).mockReturnValue(true);

      await expect(
        service.uploadSignature(transactionId, { publicKeyId, signatures }, user),
      ).rejects.toThrow('Signature already added');
      expectNotifyNotCalled();
    });

    it('should throw if the provided key should not sign the transaction', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(true);
      jest.mocked(isAlreadySigned).mockReturnValue(false);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([444]);

      await expect(
        service.uploadSignature(transactionId, { publicKeyId, signatures }, user),
      ).rejects.toThrow('This key is not required to sign this transaction');
      expectNotifyNotCalled();
    });

    it('should throw if the adding of the signatures fails', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(true);
      jest.mocked(isAlreadySigned).mockReturnValue(false);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);
      jest.mocked(addTransactionSignatures).mockImplementationOnce(() => {
        throw new Error('An Error');
      });

      await expect(
        service.uploadSignature(transactionId, { publicKeyId, signatures }, user),
      ).rejects.toThrow('An Error');
      expectNotifyNotCalled();
    });

    it('should throw if the database update fails', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(true);
      jest.mocked(isAlreadySigned).mockReturnValue(false);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);
      jest.mocked(addTransactionSignatures).mockImplementationOnce(jest.fn());
      dataSource.manager.update.mockRejectedValueOnce(new Error());

      const queryRunner = mock<QueryRunner>();
      dataSource.createQueryRunner.mockReturnValueOnce(queryRunner);

      await expect(
        service.uploadSignature(transactionId, { publicKeyId, signatures }, user),
      ).rejects.toThrow('Failed to update transaction');
      expectNotifyNotCalled();
    });

    it('should throw if the database signer creation fails', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(true);
      jest.mocked(isAlreadySigned).mockReturnValue(false);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);
      jest.mocked(addTransactionSignatures).mockImplementationOnce(jest.fn());
      signersRepo.save.mockRejectedValueOnce(new Error());

      const queryRunner = mock<QueryRunner>();
      dataSource.createQueryRunner.mockReturnValueOnce(queryRunner);

      await expect(
        service.uploadSignature(transactionId, { publicKeyId, signatures }, user),
      ).rejects.toThrow('Failed to save transaction');
      expectNotifyNotCalled();
    });
  });

  describe('uploadSignatures', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should upload signatures', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(true);
      jest.mocked(isAlreadySigned).mockReturnValue(false);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);
      jest.mocked(addTransactionSignatures).mockImplementationOnce(jest.fn());

      const queryRunner = mockDeep<QueryRunner>();
      dataSource.createQueryRunner.mockReturnValueOnce(queryRunner);

      await service.uploadSignatures(
        transactionId,
        {
          signatures: [
            {
              publicKeyId,
              signatures,
            },
          ],
        },
        user,
      );

      expect(validateSignature).toHaveBeenCalledTimes(Object.entries(signatures).length);
      expect(isAlreadySigned).toHaveBeenCalledWith(expect.anything(), user.keys[0].publicKey);
      // expect(userKeysRequiredToSign).toHaveBeenCalledWith(
      //   transaction,
      //   user,
      //   mirrorNodeService,
      //   dataSource.manager,
      // );
      expect(addTransactionSignatures).toHaveBeenCalledWith(
        expect.anything(),
        signatures,
        user.keys[0].publicKey,
      );
      expect(dataSource.manager.save).toHaveBeenCalledWith(Transaction, expect.anything());
      expect(signersRepo.create).toHaveBeenCalledWith({
        user,
        transaction,
        userKey: user.keys[0],
      });

      expect(chainService.emit).toHaveBeenCalledWith('update-transaction-status', {
        id: transactionId,
      });
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationService,
        transactionId,
        transaction.status,
      );
    });

    it.skip('should throw if signature public key does not belong to sender', async () => {
      const transactionId = 3;
      const publicKeyId = 34234;

      await expect(
        service.uploadSignatures(
          transactionId,
          { signatures: [{ publicKeyId, signatures }] },
          user,
        ),
      ).rejects.toThrow('Transaction can be signed only with your own key');
      expectNotifyNotCalled();
    });

    it('should throw if transaction is not found', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      dataSource.manager.findOneBy.mockResolvedValueOnce(null);

      await expect(
        service.uploadSignatures(
          transactionId,
          { signatures: [{ publicKeyId, signatures }] },
          user,
        ),
      ).rejects.toThrow('Transaction not found');
      expectNotifyNotCalled();
    });

    it('should throw if transaction is expired', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(true);

      await expect(
        service.uploadSignatures(
          transactionId,
          { signatures: [{ publicKeyId, signatures }] },
          user,
        ),
      ).rejects.toThrow('Transaction is expired');
      expectNotifyNotCalled();
    });

    it('should throw if transaction is canceled', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.CANCELED,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);

      await expect(
        service.uploadSignatures(
          transactionId,
          { signatures: [{ publicKeyId, signatures }] },
          user,
        ),
      ).rejects.toThrow('Transaction has been canceled');
      expectNotifyNotCalled();
    });

    it('should throw if some signature is invalid', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(false);

      await expect(
        service.uploadSignatures(
          transactionId,
          { signatures: [{ publicKeyId, signatures }] },
          user,
        ),
      ).rejects.toThrow();
      expectNotifyNotCalled();
    });

    it('should throw if transaction is already signed', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(true);
      jest.mocked(isAlreadySigned).mockReturnValue(true);

      await expect(
        service.uploadSignatures(
          transactionId,
          { signatures: [{ publicKeyId, signatures }] },
          user,
        ),
      ).rejects.toThrow('Signature already added');
      expectNotifyNotCalled();
    });

    // it('should throw if the provided key should not sign the transaction', async () => {
    //   const transactionId = 3;
    //   const publicKeyId = user.keys[0].id;

    //   const sdkTransaction = new AccountCreateTransaction();
    //   const transaction = {
    //     id: transactionId,
    //     transactionBytes: sdkTransaction.toBytes(),
    //     status: TransactionStatus.WAITING_FOR_EXECUTION,
    //   };

    //   dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
    //   jest.mocked(isExpired).mockReturnValue(false);
    //   jest.mocked(validateSignature).mockReturnValue(true);
    //   jest.mocked(isAlreadySigned).mockReturnValue(false);
    //   jest.mocked(userKeysRequiredToSign).mockResolvedValue([444]);

    //   await expect(
    //     service.uploadSignatures(
    //       transactionId,
    //       { signatures: [{ publicKeyId, signatures }] },
    //       user,
    //     ),
    //   ).rejects.toThrow('This key is not required to sign this transaction');
    // });

    it('should throw if the adding of the signatures fails', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(true);
      jest.mocked(isAlreadySigned).mockReturnValue(false);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);
      jest.mocked(addTransactionSignatures).mockImplementationOnce(() => {
        throw new Error('An Error');
      });

      await expect(
        service.uploadSignatures(
          transactionId,
          { signatures: [{ publicKeyId, signatures }] },
          user,
        ),
      ).rejects.toThrow('An Error');
      expectNotifyNotCalled();
    });

    it('should throw if the database update fails', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(true);
      jest.mocked(isAlreadySigned).mockReturnValue(false);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);
      jest.mocked(addTransactionSignatures).mockImplementationOnce(jest.fn());
      dataSource.manager.save.mockRejectedValueOnce(new Error());

      const queryRunner = mock<QueryRunner>();
      dataSource.createQueryRunner.mockReturnValueOnce(queryRunner);

      await expect(
        service.uploadSignatures(
          transactionId,
          { signatures: [{ publicKeyId, signatures }] },
          user,
        ),
      ).rejects.toThrow('Failed to update transaction');
      expectNotifyNotCalled();
    });

    it('should throw if the database signer creation fails', async () => {
      const transactionId = 3;
      const publicKeyId = user.keys[0].id;

      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: transactionId,
        transactionBytes: sdkTransaction.toBytes(),
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      dataSource.manager.findOneBy.mockResolvedValueOnce(transaction);
      jest.mocked(isExpired).mockReturnValue(false);
      jest.mocked(validateSignature).mockReturnValue(true);
      jest.mocked(isAlreadySigned).mockReturnValue(false);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([publicKeyId]);
      jest.mocked(addTransactionSignatures).mockImplementationOnce(jest.fn());
      signersRepo.save.mockRejectedValueOnce(new Error());

      const queryRunner = mock<QueryRunner>();
      dataSource.createQueryRunner.mockReturnValueOnce(queryRunner);

      await expect(
        service.uploadSignatures(
          transactionId,
          { signatures: [{ publicKeyId, signatures }] },
          user,
        ),
      ).rejects.toThrow('Failed to save transaction');
      expectNotifyNotCalled();
    });
  });

  describe('removeSignature', () => {
    it('should remove signature by calling soft delete', async () => {
      const id = 1;

      await service.removeSignature(id);

      expect(signersRepo.softDelete).toHaveBeenCalledWith(id);
    });
  });
});
