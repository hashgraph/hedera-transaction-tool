import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';
import { EntityManager } from 'typeorm';
import { SignatureMap } from '@hashgraph/sdk';

import { BlacklistService, guardMock } from '@app/common';
import { TransactionSigner, User, UserStatus } from '@entities';

import { VerifiedUserGuard } from '../../guards';

import { SignersController } from './signers.controller';
import { SignersService } from './signers.service';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { UploadSignatureMapDto } from '../dto';

jest.mock('class-transformer', () => {
  const actualModule = jest.requireActual('class-transformer');
  return {
    ...actualModule,
    plainToInstance: jest.fn(),
  };
});
jest.mock('class-validator', () => {
  const actualModule = jest.requireActual('class-validator');
  return {
    ...actualModule,
    validateOrReject: jest.fn(),
  };
});

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

  afterEach(() => {
    jest.clearAllMocks();
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
    it('should transform, validate and upload signature map for a single object', async () => {
      const dtoInput = {
        id: 1,
        signatureMap: new SignatureMap(),
      };
      const transformedDto = { transformed: 'value' };

      // Mock plainToInstance to return a transformed object
      (plainToInstance as jest.Mock).mockReturnValueOnce(transformedDto);
      // Stub validateOrReject to resolve
      (validateOrReject as jest.Mock).mockResolvedValue(undefined);
      const expectedResult = [{ id: 1 }];
      (signersService.uploadSignatureMaps as jest.Mock).mockResolvedValue(expectedResult);

      const result = await controller.uploadSignatureMap(dtoInput, user);

      expect(plainToInstance).toHaveBeenCalledWith(UploadSignatureMapDto, dtoInput);
      expect(validateOrReject).toHaveBeenCalledWith(transformedDto);
      expect(signersService.uploadSignatureMaps).toHaveBeenCalledWith([transformedDto], user);
      expect(result).toEqual(expectedResult);
    });

    it('should transform, validate and upload signature maps for an array of objects', async () => {
      const dtoInput = [
        {
          id: 1,
          signatureMap: new SignatureMap(),
        },
        {
          id: 2,
          signatureMap: new SignatureMap(),
        }
      ];
      const transformedDtos = [{ transformed: 'value1' }, { transformed: 'value2' }];

      // For each call, return the corresponding transformed object
      (plainToInstance as jest.Mock)
        .mockReturnValueOnce(transformedDtos[0])
        .mockReturnValueOnce(transformedDtos[1]);
      (validateOrReject as jest.Mock).mockResolvedValue(undefined);
      const expectedResult = [{ id: 1 }, { id: 2 }];
      (signersService.uploadSignatureMaps as jest.Mock).mockResolvedValue(expectedResult);

      const result = await controller.uploadSignatureMap(dtoInput, user);

      expect(plainToInstance).toHaveBeenCalledTimes(2);
      expect((plainToInstance as jest.Mock).mock.calls[0]).toEqual([UploadSignatureMapDto, dtoInput[0]]);
      expect((plainToInstance as jest.Mock).mock.calls[1]).toEqual([UploadSignatureMapDto, dtoInput[1]]);
      expect(validateOrReject).toHaveBeenCalledTimes(2);
      expect(signersService.uploadSignatureMaps).toHaveBeenCalledWith(transformedDtos, user);
      expect(result).toEqual(expectedResult);
    });
  });
});
