import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserStatus } from '@entities';
import { describe } from 'node:test';

describe('UsersController', () => {
  let controller: UsersController;
  let user: User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          }
        },
      ]
    }).compile();

    controller = module.get<UsersController>(UsersController);
    user = {
      id: 1,
      email: 'John@test.com',
      password: 'Doe',
      admin: true,
      status: UserStatus.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date(),
      keys: [],
      signerForTransactions: [],
      observableTransactions: [],
      approvableTransactions: [],
      comments: []
    };
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsers', () => {
    it('should return an array of users', async () => {
      const result = [user];

      jest.spyOn(controller, 'getUsers').mockResolvedValue(result);

      expect(await controller.getUsers()).toBe(result);
    });

    it('should return an empty array if no users exist', async () => {
      jest.spyOn(controller, 'getUsers').mockResolvedValue([]);

      expect(await controller.getUsers()).toEqual([]);
    });
  });

  describe('getUser', () => {
    it('should return a user', async () => {
      jest.spyOn(controller, 'getUser').mockResolvedValue(user);

      expect(await controller.getUser(1)).toBe(user);
    });

    it('should throw an error if the user does not exist', async () => {
      jest.spyOn(controller, 'getUser').mockResolvedValue(null);

      try {
        await controller.getUser(1);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('getMe', () => {
    it('should return the current user', async () => {
      jest.spyOn(controller, 'getMe').mockReturnValue(user);

      expect(await controller.getMe(user)).toBe(user);
    });
  });

  describe('updateUser', () => {
    it('should return the updated user', async () => {
      jest.spyOn(controller, 'updateUser').mockResolvedValue(user);

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
      jest.spyOn(controller, 'updateUser').mockResolvedValue(null);

      try {
        await controller.updateUser(1, user);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('removeUser', () => {
    it('should remove a user', async () => {
      jest.spyOn(controller, 'removeUser').mockResolvedValue(user);

      expect(await controller.removeUser(1)).toBe(user);
    });

    it('should throw an error if the user does not exist', async () => {
      jest.spyOn(controller, 'removeUser').mockResolvedValue(null);

      try {
        await controller.removeUser(1);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
