import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';
import { EntityManager } from 'typeorm';
import { SignatureMap } from '@hashgraph/sdk';

import { BlacklistService, guardMock } from '@app/common';
import { TransactionSigner, User, UserStatus } from '@entities';

import { VerifiedUserGuard } from '../../guards';

import { SignersController } from './signers.controller';
import { SignersService } from './signers.service';

describe('SignaturesController', () => {
  let controller: SignersController;
  let user: User;
  let signer: TransactionSigner;

  const signersService = mockDeep<SignersService>();
  const entityManager = mockDeep<EntityManager>();
  const blacklistService = mockDeep<BlacklistService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SignersController],
      providers: [
        {
          provide: SignersService,
          useValue: signersService,
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
      .overrideGuard(VerifiedUserGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get<SignersController>(SignersController);
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
    signer = {
      id: 1,
      transaction: null,
      createdAt: new Date(),
      transactionId: 1,
      user,
      userId: 1,
      userKey: null,
      userKeyId: 0,
    };
  });

  describe('getSignaturesByTransactionId', () => {
    it('should return an array of signatures', async () => {
      const result = [signer];

      signersService.getSignaturesByTransactionId.mockResolvedValue(result);

      expect(await controller.getSignaturesByTransactionId(1)).toEqual(result);
    });
  });

  describe('getSignaturesByUser', () => {
    it('should return an array of signatures', async () => {
      const result = { items: [signer], totalItems: 1, page: 1, size: 10 };
      const pagination = { page: 1, limit: 10, size: 10, offset: 0 };

      signersService.getSignaturesByUser.mockResolvedValue(result);

      expect(await controller.getSignaturesByUser(user, pagination)).toEqual(result);
    });
  });

  describe('uploadSignatureMap', () => {
    it('should return an array of signatures', async () => {
      const result = [signer];
      const body = {
        signatureMap: new SignatureMap(),
      };

      signersService.uploadSignatureMap.mockResolvedValue(result);

      expect(await controller.uploadSignatureMap(1, body, user)).toEqual(result);
    });
  });
});
