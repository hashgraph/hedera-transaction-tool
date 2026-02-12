import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { BlacklistService, guardMock, VersionCheckResult } from '@app/common';
import { Client, User, UserStatus } from '@entities';

import { VerifiedUserGuard } from '../guards';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { VersionCheckDto } from './dtos';

describe('UsersController', () => {
  let controller: UsersController;
  let user: User;

  const userService = mockDeep<UsersService>();
  const blacklistService = mockDeep<BlacklistService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: userService,
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

    controller = module.get<UsersController>(UsersController);
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
      clients: [],
    };
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsers', () => {
    it('should return an array of users', async () => {
      const result = [user];

      userService.getUsers.mockResolvedValue(result);

      expect(await controller.getUsers(user)).toBe(result);
      expect(userService.getUsers).toHaveBeenCalledWith(user);
    });

    it('should return an empty array if no users exist', async () => {
      userService.getUsers.mockResolvedValue([]);

      expect(await controller.getUsers(user)).toEqual([]);
    });

    it('should pass non-admin requesting user to the service', async () => {
      const nonAdminUser = { ...user, admin: false };
      userService.getUsers.mockResolvedValue([]);

      await controller.getUsers(nonAdminUser as User);

      expect(userService.getUsers).toHaveBeenCalledWith(nonAdminUser);
    });
  });

  describe('getUser', () => {
    it('should return a user with clients', async () => {
      userService.getUserWithClients.mockResolvedValue(user);

      expect(await controller.getUser(user, 1)).toBe(user);
      expect(userService.getUserWithClients).toHaveBeenCalledWith(1, user);
    });

    it('should throw an error if the user does not exist', async () => {
      userService.getUserWithClients.mockRejectedValue(new Error());

      await expect(controller.getUser(user, 1)).rejects.toBeInstanceOf(Error);
    });

    it('should pass non-admin requesting user to getUserWithClients', async () => {
      const nonAdminUser = { ...user, admin: false };
      userService.getUserWithClients.mockResolvedValue(user);

      await controller.getUser(nonAdminUser as User, 2);

      expect(userService.getUserWithClients).toHaveBeenCalledWith(2, nonAdminUser);
    });

    it('should pass the correct id to getUserWithClients', async () => {
      userService.getUserWithClients.mockResolvedValue(user);

      await controller.getUser(user, 42);

      expect(userService.getUserWithClients).toHaveBeenCalledWith(42, user);
    });
  });

  describe('getMe', () => {
    it('should return the current user', async () => {
      expect(await controller.getMe(user)).toBe(user);
    });
  });

  describe('updateUser', () => {
    it('should return the updated user', async () => {
      userService.updateUserById.mockResolvedValue(user);

      expect(await controller.updateUser(1, user)).toBe(user);
    });

    it('should throw an error if admin value is not supplied', async () => {
      const invalidUser = { ...user, admin: null };

      try {
        await controller.updateUser(1, invalidUser);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should throw an error if the user does not exist', async () => {
      userService.updateUser.mockResolvedValue(null);

      try {
        await controller.updateUser(1, user);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('removeUser', () => {
    it('should remove a user', async () => {
      userService.removeUser.mockResolvedValue(true);

      expect(await controller.removeUser(user, 2)).toBe(true);
    });

    it('should throw an error if the user does not exist', async () => {
      userService.removeUser.mockResolvedValue(null);

      try {
        await controller.removeUser(user, 2);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should throw an error if the user tries to remove themselves', async () => {
      try {
        await controller.removeUser(user, 1);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('versionCheck', () => {
    const mockVersionCheckResult: VersionCheckResult = {
      latestSupportedVersion: '1.2.0',
      minimumSupportedVersion: '1.0.0',
      updateUrl: 'https://github.com/hashgraph/hedera-transaction-tool/releases/download/v1.2.0/',
    };

    beforeEach(() => {
      userService.getVersionCheckInfo.mockReturnValue(mockVersionCheckResult);
    });

    it('should call usersService.updateClientVersion with correct params', async () => {
      const dto: VersionCheckDto = { version: '1.0.0' };
      const client: Partial<Client> = { id: 1, userId: user.id, version: dto.version };
      userService.updateClientVersion.mockResolvedValue(client as Client);

      await controller.versionCheck(user, dto);

      expect(userService.updateClientVersion).toHaveBeenCalledWith(user.id, dto.version);
    });

    it('should call usersService.getVersionCheckInfo with user version', async () => {
      const dto: VersionCheckDto = { version: '1.0.0' };
      const client: Partial<Client> = { id: 1, userId: user.id, version: dto.version };
      userService.updateClientVersion.mockResolvedValue(client as Client);

      await controller.versionCheck(user, dto);

      expect(userService.getVersionCheckInfo).toHaveBeenCalledWith(dto.version);
    });

    it('should return success response with version info when update is available', async () => {
      const dto: VersionCheckDto = { version: '1.0.0' };
      const client: Partial<Client> = { id: 1, userId: user.id, version: dto.version };
      userService.updateClientVersion.mockResolvedValue(client as Client);

      const result = await controller.versionCheck(user, dto);

      expect(result).toEqual(mockVersionCheckResult);
    });

    it('should return response without updateUrl when version is up to date', async () => {
      const dto: VersionCheckDto = { version: '1.2.0' };
      const client: Partial<Client> = { id: 1, userId: user.id, version: dto.version };
      userService.updateClientVersion.mockResolvedValue(client as Client);

      const noUpdateResult: VersionCheckResult = {
        latestSupportedVersion: '1.2.0',
        minimumSupportedVersion: '1.0.0',
        updateUrl: null,
      };
      userService.getVersionCheckInfo.mockReturnValue(noUpdateResult);

      const result = await controller.versionCheck(user, dto);

      expect(result).toEqual(noUpdateResult);
      expect(result.updateUrl).toBeNull();
    });

    it('should return response when user version is newer than latest supported', async () => {
      const dto: VersionCheckDto = { version: '2.0.0' };
      const client: Partial<Client> = { id: 1, userId: user.id, version: dto.version };
      userService.updateClientVersion.mockResolvedValue(client as Client);

      const newerVersionResult: VersionCheckResult = {
        latestSupportedVersion: '1.2.0',
        minimumSupportedVersion: '1.0.0',
        updateUrl: null,
      };
      userService.getVersionCheckInfo.mockReturnValue(newerVersionResult);

      const result = await controller.versionCheck(user, dto);

      expect(result.updateUrl).toBeNull();
    });

    it('should throw an error if the service fails', async () => {
      const dto: VersionCheckDto = { version: '1.0.0' };
      userService.updateClientVersion.mockRejectedValue(new Error('Database error'));

      await expect(controller.versionCheck(user, dto)).rejects.toThrow('Database error');
    });
  });

  describe('UsersController', () => {
    let controller: UsersController;

    const userService = mockDeep<UsersService>();
    const blacklistService = mockDeep<BlacklistService>();

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [UsersController],
        providers: [
          {
            provide: UsersService,
            useValue: userService,
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

      controller = module.get<UsersController>(UsersController);
    });

    describe('getUserByPublicKey', () => {
      it('should return an email if a public key is found', async () => {
        const publicKey = 'c12e815869ad5d9f5357636cf487fe8e30cc085043a49ee8d16ca69ddcffbed9';
        const email = 'user@example.com';

        userService.getOwnerOfPublicKey.mockResolvedValue(email);

        expect(await controller.getUserByPublicKey(publicKey)).toBe(email);
      });

      it('should return null if no user is found for the given public key', async () => {
        const publicKey = 'non-existent-public-key';

        userService.getOwnerOfPublicKey.mockResolvedValue(null);

        expect(await controller.getUserByPublicKey(publicKey)).toBeNull();
      });

      it('should throw an error if the service fails', async () => {
        const publicKey = 'c12e815869ad5d9f5357636cf487fe8e30cc085043a49ee8d16ca69ddcffbed9';

        userService.getOwnerOfPublicKey.mockRejectedValue(new Error('Database error'));

        await expect(controller.getUserByPublicKey(publicKey)).rejects.toThrow('Database error');
      });
    });
  });
});
