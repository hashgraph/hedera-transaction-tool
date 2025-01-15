import { ClientProxy } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import { NOTIFICATIONS_SERVICE } from '@app/common';
import { asyncFilter, notifyTransactionAction } from '@app/common/utils';
import { TransactionGroup, User, UserStatus } from '@entities';

import { CreateTransactionGroupDto } from '../dto';

import { TransactionGroupsService } from './transaction-groups.service';
import { TransactionsService } from '../transactions.service';

jest.mock('@app/common/utils');

describe('TransactionGroupsService', () => {
  let service: TransactionGroupsService;

  const transactionsService = mockDeep<TransactionsService>();
  const dataSource = mockDeep<DataSource>();
  const notificationsService = mockDeep<ClientProxy>();

  const user: Partial<User> = {
    id: 1,
    email: 'some@email.com',
    password: 'hash',
    admin: false,
    status: UserStatus.NONE,
  };

  const userWithKeys = {
    ...user,
    keys: [{ id: 1, publicKey: '0x', mnemonicHash: 'hash' }],
  } as User;

  const mockTransaction = () => {
    const transactionMock = jest.fn(async passedFunction => {
      await passedFunction(dataSource.manager);
    });
    dataSource.transaction.mockImplementation(transactionMock);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionGroupsService,
        {
          provide: TransactionsService,
          useValue: transactionsService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: NOTIFICATIONS_SERVICE,
          useValue: notificationsService,
        },
      ],
    }).compile();

    service = module.get<TransactionGroupsService>(TransactionGroupsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTransactionGroups', () => {
    it('should call repo to find all groups', async () => {
      await service.getTransactionGroups();
      expect(dataSource.manager.find).toHaveBeenCalled();
    });
  });

  describe('createTransactionGroup', () => {
    beforeEach(() => {
      jest.resetAllMocks();

      mockTransaction();
    });

    it('should create a transaction group', async () => {
      const dto: CreateTransactionGroupDto = {
        description: 'description',
        atomic: true,
        sequential: false,
        groupItems: [
          {
            seq: 1,
            transaction: {
              name: 'Transaction 1',
              description: 'Description',
              transactionBytes: Buffer.from('0xabc01'),
              creatorKeyId: 1,
              signature: Buffer.from('0xabc02'),
              mirrorNetwork: 'testnet',
            },
          },
          {
            seq: 2,
            transaction: {
              name: 'Transaction 2',
              description: 'Description',
              transactionBytes: Buffer.from('0xabc03'),
              creatorKeyId: 1,
              signature: Buffer.from('0xabc04'),
              mirrorNetwork: 'testnet',
            },
          },
        ],
        groupValidStart: new Date(),
      };

      dataSource.manager.create.mockImplementation((entity, data) => ({ ...data }));

      await service.createTransactionGroup(userWithKeys, dto);

      expect(dataSource.manager.create).toHaveBeenCalledWith(TransactionGroup, dto);
      expect(dataSource.manager.create).toHaveBeenCalledTimes(3);
      expect(transactionsService.createTransaction).toHaveBeenCalledTimes(2);
      expect(dataSource.manager.save).toHaveBeenCalledTimes(4);
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
    });
  });

  describe('getTransactionGroup', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should throw BadRequestException if no group found', async () => {
      dataSource.manager.findOne.mockResolvedValue(undefined);
      await expect(service.getTransactionGroup(user as User, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw UnauthorizedException if user has no access to any group items', async () => {
      const mockGroup = {
        id: 1,
        groupItems: [{ transaction: { id: 1 } }, { transaction: { id: 2 } }],
      };
      dataSource.manager.findOne.mockResolvedValue(mockGroup);
      jest.mocked(asyncFilter).mockResolvedValueOnce([]);
      transactionsService.verifyAccess.mockResolvedValue(false);
      await expect(service.getTransactionGroup(user as User, 1)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return the transaction group if user has access to at least one group item', async () => {
      const mockGroup = {
        id: 1,
        groupItems: [{ transaction: { id: 1 } }, { transaction: { id: 2 } }],
      };
      const expectedGroup = {
        ...mockGroup,
        groupItems: [{ transaction: { id: 1 } }],
      };
      dataSource.manager.findOne.mockResolvedValue(mockGroup);
      jest.mocked(asyncFilter).mockResolvedValueOnce(expectedGroup.groupItems);
      transactionsService.verifyAccess.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      const result = await service.getTransactionGroup(user as User, 1);
      expect(result).toEqual(expectedGroup);
    });
  });

  describe('removeTransactionGroup', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should throw an error if the group is not found', async () => {
      dataSource.manager.findOneBy.mockResolvedValue(undefined);
      await expect(service.removeTransactionGroup(user as User, 1)).rejects.toThrow(
        'group not found',
      );
    });

    it('should remove all group items and the group itself', async () => {
      const mockGroup = { id: 1 };
      const mockGroupItems = [
        { id: 1, transactionId: 101 },
        { id: 2, transactionId: 102 },
      ];

      dataSource.manager.findOneBy.mockResolvedValue(mockGroup);
      dataSource.manager.find.mockResolvedValue(mockGroupItems);
      dataSource.manager.remove
        //@ts-expect-error - typings
        .mockResolvedValueOnce(mockGroupItems[0])
        //@ts-expect-error - typings
        .mockResolvedValueOnce(mockGroupItems[1])
        //@ts-expect-error - typings
        .mockResolvedValueOnce(mockGroup);

      await service.removeTransactionGroup(user as User, 1);

      expect(dataSource.manager.remove).toHaveBeenCalledTimes(3); // Twice for group items, once for the group
      expect(transactionsService.removeTransaction).toHaveBeenCalledTimes(mockGroupItems.length);
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
    });
  });
});
