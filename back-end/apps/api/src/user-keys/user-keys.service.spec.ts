import { mockDeep } from 'jest-mock-extended';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ErrorCodes } from '@app/common';
import { attachKeys } from '@app/common/utils';
import { User, UserKey } from '@entities';

import { MAX_USER_KEYS, UserKeysService } from './user-keys.service';

import { UploadUserKeyDto } from './dtos';

jest.mock('@app/common/utils');
describe('UserKeysService', () => {
  let service: UserKeysService;

  const repo = mockDeep<Repository<UserKey>>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserKeysService,
        {
          provide: getRepositoryToken(UserKey),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<UserKeysService>(UserKeysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserKey', () => {
    it('should return null if where condition is not provided', async () => {
      expect(await service.getUserKey(undefined)).toBeNull();
    });

    it('should return a UserKey if where condition is provided', async () => {
      await service.getUserKey({ id: 1 });

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 }, relations: undefined });
    });

    it('should handle relations when provided', async () => {
      await service.getUserKey({ id: 1 }, { user: true });

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 }, relations: { user: true } });
    });
  });

  describe('uploadKey', () => {
    let user: User;
    let dto: UploadUserKeyDto;

    beforeEach(() => {
      user = { id: 1 } as unknown as User;
      dto = { publicKey: 'test-public-key', mnemonicHash: 'test-hash', index: 0 };
    });

    it('should throw BadRequestException if public key is in use by a different user', async () => {
      const existingUserKey = {
        userId: 2,
        publicKey: dto.publicKey,
        mnemonicHash: dto.mnemonicHash,
        index: dto.index,
      };
      jest.mocked(attachKeys).mockImplementationOnce(async (user: User) => {
        user.keys = [];
      });
      repo.findOne.mockResolvedValue(existingUserKey as UserKey);

      await expect(service.uploadKey(user, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if public key is in use but dto has different index', async () => {
      const existingUserKey = {
        userId: user.id,
        publicKey: dto.publicKey,
        mnemonicHash: dto.mnemonicHash,
        index: 333,
      };
      jest.mocked(attachKeys).mockImplementationOnce(async (user: User) => {
        user.keys = [];
      });
      repo.findOne.mockResolvedValue(existingUserKey as UserKey);

      await expect(service.uploadKey(user, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user has too many keys', async () => {
      user.keys = Array.from({ length: MAX_USER_KEYS }, (_, i) => ({
        id: i + 1,
        publicKey: `key-${i}`,
        userId: user.id,
      })) as UserKey[];

      await expect(service.uploadKey(user, dto)).rejects.toThrow(BadRequestException);
    });

    it('should update userKey if it exists and is owned by the same user', async () => {
      const existingUserKey = { userId: user.id, publicKey: dto.publicKey } as UserKey;
      jest.mocked(attachKeys).mockImplementationOnce(async (user: User) => {
        user.keys = [];
      });
      repo.findOne.mockResolvedValue(existingUserKey);
      repo.save.mockResolvedValue({ ...existingUserKey, ...dto });

      const result = await service.uploadKey(user, dto);

      expect(repo.save).toHaveBeenCalledWith({ ...existingUserKey, ...dto });
      expect(result).toEqual({ ...existingUserKey, ...dto });
    });

    it('should create and save a new userKey if it does not exist', async () => {
      jest.mocked(attachKeys).mockImplementationOnce(async (user: User) => {
        user.keys = [];
      });
      repo.findOne.mockResolvedValue(undefined);
      const newUserKey = { ...dto, user: user } as UserKey;
      repo.create.mockReturnValue(newUserKey);
      repo.save.mockResolvedValue(newUserKey);

      const result = await service.uploadKey(user, dto);

      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(repo.save).toHaveBeenCalledWith(newUserKey);
      expect(result).toEqual(newUserKey);
    });

    it('should recover and save the userKey if it was deleted', async () => {
      jest.mocked(attachKeys).mockImplementationOnce(async (user: User) => {
        user.keys = [];
      });
      const deletedUserKey = { ...dto, userId: user.id, deletedAt: new Date() } as UserKey;
      repo.findOne.mockResolvedValue(deletedUserKey);

      await service.uploadKey(user, dto);

      expect(repo.recover).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('getUserKeysRestricted', () => {
    let user: User;

    beforeEach(() => {
      jest.resetAllMocks();
      user = { id: 1 } as unknown as User;
    });

    it('should return an empty array if userId is not provided', async () => {
      const result = await service.getUserKeysRestricted(user, undefined);
      expect(result).toEqual([]);
    });

    it('should return user keys for a given userId', async () => {
      const userId = 1;
      const mockUserKeys = [
        { id: 1, publicKey: 'key1', userId },
        { id: 2, publicKey: 'key2', userId },
      ] as UserKey[];
      repo.find.mockResolvedValue(mockUserKeys);

      const result = await service.getUserKeysRestricted(user, userId);

      expect(repo.find).toHaveBeenCalledWith({
        select: {
          deletedAt: true,
          id: true,
          index: true,
          mnemonicHash: true,
          publicKey: true,
          userId: true,
        },
        where: { userId },
      });
      expect(result).toEqual(mockUserKeys);
    });

    it('should return user keys with only public key if user is not the owner', async () => {
      const userId = 1;
      const mockUserKeys = [
        { id: 1, publicKey: 'key1', userId },
        { id: 2, publicKey: 'key2', userId },
      ] as UserKey[];
      repo.find.mockResolvedValue(mockUserKeys);

      const result = await service.getUserKeysRestricted({ id: 2 } as User, userId);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId },
        select: {
          id: true,
          userId: true,
          mnemonicHash: false,
          index: false,
          publicKey: true,
          deletedAt: true,
        },
      });
      expect(result).toEqual(mockUserKeys);
    });
  });

  describe('removeKey', () => {
    it('should throw BadRequestException if the key does not exist', async () => {
      repo.findOne.mockResolvedValue(undefined);

      await expect(service.removeKey(1)).rejects.toThrow(ErrorCodes.KNF);
    });

    it('should soft remove the user key if it exists', async () => {
      const userKey = { id: 1, publicKey: 'test-public-key' } as UserKey;
      repo.findOne.mockResolvedValue(userKey);

      const result = await service.removeKey(1);

      expect(repo.softRemove).toHaveBeenCalledWith(userKey);
      expect(result).toEqual(true);
    });
  });

  describe('removeUserKey', () => {
    let user: User;
    let userKey: UserKey;

    beforeEach(() => {
      user = { id: 1 } as User;
      userKey = { id: 1, publicKey: 'test-public-key', userId: user.id } as UserKey;
    });

    it('should throw BadRequestException if the key does not exist', async () => {
      service.getUserKey = jest.fn().mockResolvedValue(undefined);

      await expect(service.removeUserKey(user, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if the key is not owned by the user', async () => {
      const anotherUser = { id: 2 } as User;
      service.getUserKey = jest.fn().mockResolvedValue({ ...userKey, userId: anotherUser.id });

      await expect(service.removeUserKey(user, 1)).rejects.toThrow(BadRequestException);
    });

    it('should soft remove the user key if it exists and is owned by the user', async () => {
      service.getUserKey = jest.fn().mockResolvedValue(userKey);
      const softRemoveSpy = jest.spyOn(repo, 'softRemove').mockResolvedValue(undefined);

      const result = await service.removeUserKey(user, 1);

      expect(softRemoveSpy).toHaveBeenCalledWith(userKey);
      expect(result).toEqual(true);
    });
  });

  describe('getUserKeysCount', () => {
    it('should return the count of user keys for a given userId', async () => {
      const userId = 1;
      const expectedCount = 5;
      repo.count.mockResolvedValue(expectedCount);

      const result = await service.getUserKeysCount(userId);

      expect(repo.count).toHaveBeenCalledWith({ where: { userId } });
      expect(result).toEqual(expectedCount);
    });
  });
});
