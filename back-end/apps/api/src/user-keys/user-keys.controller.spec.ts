import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { guardMock } from '@app/common';
import { User, UserKey, UserStatus } from '@entities';

import { UserKeysController } from './user-keys.controller';

import { MAX_USER_KEYS, UserKeysService } from './user-keys.service';
import { VerifiedUserGuard } from '../guards';

describe('UserKeysController', () => {
  let controller: UserKeysController;
  let user: User;
  let userKey: UserKey;

  const userKeysService = mockDeep<UserKeysService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserKeysController],
      providers: [
        {
          provide: UserKeysService,
          useValue: userKeysService,
        },
      ],
    })
      .overrideGuard(VerifiedUserGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get<UserKeysController>(UserKeysController);

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
    };

    userKey = {
      id: 1,
      publicKey: 'publicKey',
      mnemonicHash: 'mnemonicHash',
      index: 1,
      user: user,
      deletedAt: null,
      createdTransactions: [],
      approvedTransactions: [],
      signedTransactions: [],
    };
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getKey', () => {
    it('should return a key', async () => {
      userKeysService.uploadKey.mockResolvedValue(userKey);

      expect(await controller.uploadKey(user, userKey)).toBe(userKey);
    });

    it('should return an error if publicKey is not supplied', async () => {
      const invalidUserKey = { ...userKey, publicKey: null };

      userKeysService.uploadKey.mockRejectedValue(new Error('Public Key in use.'));

      await expect(controller.uploadKey(user, invalidUserKey)).rejects.toThrow(Error);
    });

    it('should return an error if the user has too many keys', async () => {
      userKeysService.uploadKey.mockRejectedValue(new Error(`A user can only have up to ${MAX_USER_KEYS} keys.`));

      await expect(controller.uploadKey(user, userKey)).rejects.toThrow(Error);
    });
  });

  describe('getKeys', () => {
    it('should return an array of keys', async () => {
      const result = [userKey];

      userKeysService.getUserKeys.mockResolvedValue(result);

      expect(await controller.getUserKeys(1)).toBe(result);
    });

    it('should return an empty array if no keys exist', async () => {
      userKeysService.getUserKeys.mockResolvedValue([]);

      expect(await controller.getUserKeys(1)).toEqual([]);
    });
  });

  describe('removeKey', () => {
    it('should return a key', async () => {
      userKeysService.removeKey.mockResolvedValue(true);

      expect(await controller.removeKey(1)).toBe(true);
    });

    it('should return an error if key does not exist', async () => {
      userKeysService.removeKey.mockRejectedValue(new Error('Key not found'));

      await expect(controller.removeKey(1)).rejects.toThrow(Error);
    });
  });
});
