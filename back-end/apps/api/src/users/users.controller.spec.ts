import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { guardMock } from '@app/common';
import { User, UserStatus } from '@entities';

import { UsersController } from './users.controller';

import { UsersService } from './users.service';
import { VerifiedUserGuard } from '../guards';

describe('UsersController', () => {
  let controller: UsersController;
  let user: User;

  const userService = mockDeep<UsersService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: userService,
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
    };
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsers', () => {
    it('should return an array of users', async () => {
      const result = [user];

      userService.getUsers.mockResolvedValue(result);

      expect(await controller.getUsers()).toBe(result);
    });

    it('should return an empty array if no users exist', async () => {
      userService.getUsers.mockResolvedValue([]);

      expect(await controller.getUsers()).toEqual([]);
    });
  });

  describe('getUser', () => {
    it('should return a user', async () => {
      userService.getUser.mockResolvedValue(user);

      expect(await controller.getUser(1)).toBe(user);
    });

    it('should throw an error if the user does not exist', async () => {
      userService.getUser.mockResolvedValue(null);

      try {
        await controller.getUser(1);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
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

      expect(await controller.removeUser(1)).toBe(true);
    });

    it('should throw an error if the user does not exist', async () => {
      userService.removeUser.mockResolvedValue(null);

      try {
        await controller.removeUser(1);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
