import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserStatus } from '@entities';

describe('UsersController', () => {
  let controller: UsersController;

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
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return an array of users', async () => {
    const result = [
      {
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
      }
    ];
    jest.spyOn(controller, 'getUsers').mockResolvedValue(result);

    expect(await controller.getUsers()).toBe(result);
  });

  it('should return a user', async () => {
    const result = {
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
    jest.spyOn(controller, 'getUser').mockResolvedValue(result);

    expect(await controller.getUser(1)).toBe(result);
  });

  it('should return the updated user', async () => {
    const result = {
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
    jest.spyOn(controller, 'updateUser').mockResolvedValue(result);

    expect(await controller.updateUser(1, result)).toBe(result);
  });

  it('should remove a user', async () => {
    const result = {
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
    jest.spyOn(controller, 'removeUser').mockResolvedValue(result);

    expect(await controller.removeUser(1)).toBe(result);
  });
});
