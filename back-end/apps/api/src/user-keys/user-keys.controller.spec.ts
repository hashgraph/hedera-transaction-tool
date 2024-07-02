import { Test, TestingModule } from '@nestjs/testing';
import { UserKeysController } from './user-keys.controller';
import { UserKeysService } from './user-keys.service';
import { User, UserKey, UserStatus } from '@entities';

describe('UserKeysController', () => {
  let controller: UserKeysController;
  let user: User;
  let userKey: UserKey;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserKeysController],
      providers: [
        {
          provide: UserKeysService,
          useValue: {
            createKey: jest.fn(),
            deleteKey: jest.fn(),
            getKeys: jest.fn(),
            getKey: jest.fn(),
          },
        },
      ],
    }).compile();

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
      comments: []
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
      signedTransactions: []
    };
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getKey', () => {
    it('should return a key', async () => {
      jest.spyOn(controller, 'uploadKey').mockResolvedValue(userKey);

      expect(await controller.uploadKey(user, userKey)).toBe(userKey);
    });

    it('should return an error if publicKey is not supplied', async () => {
      const invalidUserKey = { ...userKey, publicKey: null };

      try {
        await controller.uploadKey(user, invalidUserKey);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('getKeys', () => {
    it('should return an array of keys', async () => {
      const result = [userKey];

      jest.spyOn(controller, 'getUserKeys').mockResolvedValue(result);

      expect(await controller.getUserKeys(1)).toBe(result);
    });

    it('should return an empty array if no keys exist', async () => {
      jest.spyOn(controller, 'getUserKeys').mockResolvedValue([]);

      expect(await controller.getUserKeys(1)).toEqual([]);
    });
  });

  describe('removeKey', () => {
    it('should return a key', async () => {
      jest.spyOn(controller, 'removeKey').mockResolvedValue(userKey);

      expect(await controller.removeKey(1)).toBe(userKey);
    });

    it('should return an error if key does not exist', async () => {
      jest.spyOn(controller, 'removeKey').mockResolvedValue(null);

      try {
        await controller.removeKey(1);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
