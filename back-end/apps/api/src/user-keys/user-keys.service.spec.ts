import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';

import { mockDeep } from 'jest-mock-extended';

import { User, UserKey } from '@entities';

import { UserKeysService } from './user-keys.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
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
    const user = { id: 1, name: 'Test User' } as unknown as User;
    const dto = { publicKey: 'test-public-key', mnemonicHash: 'test-hash', index: 0 };

    it('should throw BadRequestException if public key is in use by a different user', async () => {
      const existingUserKey = {
        user: { id: 2 },
        publicKey: dto.publicKey,
        mnemonicHash: dto.mnemonicHash,
        index: dto.index,
      };
      repo.findOne.mockResolvedValue(existingUserKey as UserKey);

      await expect(service.uploadKey(user, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if public key is in use but dto has different mnemonic', async () => {
      const existingUserKey = {
        user,
        publicKey: dto.publicKey,
        mnemonicHash: 'different-hash',
        index: dto.index,
      };
      repo.findOne.mockResolvedValue(existingUserKey as UserKey);

      await expect(service.uploadKey(user, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if public key is in use but dto has different index', async () => {
      const existingUserKey = {
        user,
        publicKey: dto.publicKey,
        mnemonicHash: dto.mnemonicHash,
        index: 333,
      };
      repo.findOne.mockResolvedValue(existingUserKey as UserKey);

      await expect(service.uploadKey(user, dto)).rejects.toThrow(BadRequestException);
    });

    it('should update userKey if it exists and is owned by the same user', async () => {
      const existingUserKey = { user: { id: user.id }, publicKey: dto.publicKey } as UserKey;
      repo.findOne.mockResolvedValue(existingUserKey);
      repo.save.mockResolvedValue({ ...existingUserKey, ...dto });

      const result = await service.uploadKey(user, dto);

      expect(repo.save).toHaveBeenCalledWith({ ...existingUserKey, ...dto });
      expect(result).toEqual({ ...existingUserKey, ...dto });
    });

    it('should create and save a new userKey if it does not exist', async () => {
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
      const deletedUserKey = { ...dto, user: user, deletedAt: new Date() } as UserKey;
      repo.findOne.mockResolvedValue(deletedUserKey);

      await service.uploadKey(user, dto);

      expect(repo.recover).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('getUserKeys', () => {
    it('should return an empty array if userId is not provided', async () => {
      const result = await service.getUserKeys(undefined);
      expect(result).toEqual([]);
    });

    it('should return user keys for a given userId', async () => {
      const userId = 1;
      const mockUserKeys = [
        { id: 1, publicKey: 'key1', user: { id: userId } },
        { id: 2, publicKey: 'key2', user: { id: userId } },
      ] as UserKey[];
      repo.find.mockResolvedValue(mockUserKeys);

      const result = await service.getUserKeys(userId);

      expect(repo.find).toHaveBeenCalledWith({
        where: { user: { id: userId } },
        relations: { user: true },
      });
      expect(result).toEqual(mockUserKeys);
    });
  });

  describe('removeKey', () => {
    it('should throw NotFoundException if the key does not exist', async () => {
      repo.findOne.mockResolvedValue(undefined);

      await expect(service.removeKey(1)).rejects.toThrow('Key not found');
    });

    it('should soft remove the user key if it exists', async () => {
      const userKey = { id: 1, publicKey: 'test-public-key' } as UserKey;
      repo.findOne.mockResolvedValue(userKey);

      const result = await service.removeKey(1);

      expect(repo.softRemove).toHaveBeenCalledWith(userKey);
      expect(result).toEqual(true);
    });
  });

  describe('getUserKeysCount', () => {
    it('should return the count of user keys for a given userId', async () => {
      const userId = 1;
      const expectedCount = 5;
      repo.count.mockResolvedValue(expectedCount);

      const result = await service.getUserKeysCount(userId);

      expect(repo.count).toHaveBeenCalledWith({ where: { user: { id: userId } } });
      expect(result).toEqual(expectedCount);
    });
  });
});
