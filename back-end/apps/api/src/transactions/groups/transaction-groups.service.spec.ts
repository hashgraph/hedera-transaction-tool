import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { mock, mockDeep } from 'jest-mock-extended';

import { asyncFilter, emitTransactionUpdate } from '@app/common/utils';
import { Transaction, TransactionGroup, User, UserStatus } from '@entities';

import { CreateTransactionGroupDto } from '../dto';

import { TransactionGroupsService } from './transaction-groups.service';
import { TransactionsService } from '../transactions.service';
import { NatsPublisherService } from '@app/common';

jest.mock('@app/common/utils');

describe('TransactionGroupsService', () => {
  let service: TransactionGroupsService;

  const transactionsService = mockDeep<TransactionsService>();
  const dataSource = mockDeep<DataSource>();
  const notificationsPublisher = mock<NatsPublisherService>();

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
          provide: NatsPublisherService,
          useValue: notificationsPublisher,
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
      };

      dataSource.manager.create.mockImplementation((entity, data) => ({ ...data }));
      transactionsService.createTransactions.mockImplementation(async (dtos, _) => {
        return dtos.map((dto, index) => dto as unknown as Transaction);
      });

      await service.createTransactionGroup(userWithKeys, dto);

      expect(dataSource.manager.create).toHaveBeenCalledWith(TransactionGroup, dto);
      expect(dataSource.manager.create).toHaveBeenCalledTimes(3);
      expect(transactionsService.createTransactions).toHaveBeenCalledTimes(1);
      expect(dataSource.manager.save).toHaveBeenCalledTimes(2);
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

    it('calls attachTransactionSigners/Approvers for each group item and filters by verifyAccess', async () => {
      const mockGroup = {
        id: 1,
        groupItems: [{ transaction: { id: 1 } }, { transaction: { id: 2 } }],
      };
      dataSource.manager.findOne.mockResolvedValue(mockGroup);

      // Make asyncFilter actually invoke the provided callback so attach* functions are called
      jest.mocked(asyncFilter).mockImplementationOnce(async (arr, cb) => {
        const out: typeof arr = [];
        for (const item of arr) {
          // call the real callback used in the service
          // eslint-disable-next-line @typescript-eslint/await-thenable
          const keep = await cb(item);
          if (keep) out.push(item);
        }
        return out;
      });

      // Ensure attach methods are present and resolvable
      transactionsService.attachTransactionSigners.mockResolvedValue(undefined);
      transactionsService.attachTransactionApprovers.mockResolvedValue(undefined);

      // verifyAccess returns true for first item, false for second
      transactionsService.verifyAccess
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await service.getTransactionGroup(user as User, 1);

      expect(transactionsService.attachTransactionSigners).toHaveBeenCalledTimes(2);
      expect(transactionsService.attachTransactionApprovers).toHaveBeenCalledTimes(2);
      expect(transactionsService.verifyAccess).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        ...mockGroup,
        groupItems: [{ transaction: { id: 1 } }],
      });
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
      expect(emitTransactionUpdate).toHaveBeenCalledWith(
        notificationsPublisher,
        expect.arrayContaining([
          expect.objectContaining({ entityId: 101 }),
          expect.objectContaining({ entityId: 102 }),
        ]),
      );
    });
  });
});
