import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { mock, mockDeep } from 'jest-mock-extended';

import { emitTransactionUpdate } from '@app/common/utils';
import { Transaction, TransactionGroup, User, UserStatus } from '@entities';

import { CreateTransactionGroupDto } from '../dto';

import { TransactionGroupsService } from './transaction-groups.service';
import { TransactionsService } from '../transactions.service';
import { NatsPublisherService, SqlBuilderService } from '@app/common';

jest.mock('@app/common/utils');

describe('TransactionGroupsService', () => {
  let service: TransactionGroupsService;

  const transactionsService = mockDeep<TransactionsService>();
  const dataSource = mockDeep<DataSource>();
  const notificationsPublisher = mock<NatsPublisherService>();
  const sqlBuilderService = mock<SqlBuilderService>();

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
        {
          provide: SqlBuilderService,
          useValue: sqlBuilderService,
        }
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
        return dtos.map(dto => dto as unknown as Transaction);
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

    const mockGroup = { id: 1, groupItems: [] };

    const mockRows = [
      {
        tx_id: 10,
        tx_name: 'Tx 1',
        tx_type: 'CRYPTO_TRANSFER',
        tx_description: 'desc 1',
        sdk_transaction_id: 'sdk-1',
        tx_transaction_hash: 'hash-1',
        tx_transaction_bytes: Buffer.from('bytes-1'),
        tx_unsigned_transaction_bytes: Buffer.from('unsigned-1'),
        tx_status: 'PENDING',
        tx_status_code: null,
        tx_creator_key_id: 1,
        tx_signature: Buffer.from('sig-1'),
        tx_valid_start: new Date('2024-01-01'),
        tx_mirror_network: 'testnet',
        tx_is_manual: false,
        tx_cutoff_at: null,
        tx_created_at: new Date('2024-01-01'),
        tx_executed_at: null,
        tx_updated_at: new Date('2024-01-01'),
        gi_seq: 1,
        tx_creator_key_user_id: 1,
        tx_creator_email: 'test@email.com',
      },
      {
        tx_id: 11,
        tx_name: 'Tx 2',
        tx_type: 'CRYPTO_TRANSFER',
        tx_description: 'desc 2',
        sdk_transaction_id: 'sdk-2',
        tx_transaction_hash: 'hash-2',
        tx_transaction_bytes: Buffer.from('bytes-2'),
        tx_unsigned_transaction_bytes: Buffer.from('unsigned-2'),
        tx_status: 'PENDING',
        tx_status_code: null,
        tx_creator_key_id: 1,
        tx_signature: Buffer.from('sig-2'),
        tx_valid_start: new Date('2024-01-02'),
        tx_mirror_network: 'testnet',
        tx_is_manual: false,
        tx_cutoff_at: null,
        tx_created_at: new Date('2024-01-02'),
        tx_executed_at: null,
        tx_updated_at: new Date('2024-01-02'),
        gi_seq: 2,
        tx_creator_key_user_id: 1,
        tx_creator_email: 'test@email.com',
      },
    ];

    it('should throw BadRequestException if group is not found', async () => {
      dataSource.manager.findOne.mockResolvedValue(undefined);

      await expect(service.getTransactionGroup(userWithKeys, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw UnauthorizedException if query returns no rows', async () => {
      dataSource.manager.findOne.mockResolvedValue(mockGroup);
      dataSource.manager.query.mockResolvedValue([]);
      dataSource.manager.create.mockImplementation((_, data) => ({ ...data }));

      await expect(service.getTransactionGroup(userWithKeys, 1)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return group with mapped groupItems when full is false', async () => {
      dataSource.manager.findOne.mockResolvedValue(mockGroup);
      dataSource.manager.query.mockResolvedValue(mockRows);
      dataSource.manager.create.mockImplementation((_, data) => ({ ...data }));

      const result = await service.getTransactionGroup(userWithKeys, 1);

      expect(result.groupItems).toHaveLength(2);
      expect(result.groupItems[0]).toMatchObject({
        seq: 1,
        groupId: 1,
        transactionId: 10,
        transaction: expect.objectContaining({
          id: 10,
          name: 'Tx 1',
          status: 'PENDING',
          mirrorNetwork: 'testnet',
        }),
      });
      expect(result.groupItems[1]).toMatchObject({
        seq: 2,
        groupId: 1,
        transactionId: 11,
      });
    });

    it('should not fetch signers/approvers/observers when full is false', async () => {
      dataSource.manager.findOne.mockResolvedValue(mockGroup);
      dataSource.manager.query.mockResolvedValue(mockRows);
      dataSource.manager.create.mockImplementation((_, data) => ({ ...data }));

      await service.getTransactionGroup(userWithKeys, 1, false);

      expect(transactionsService.getTransactionSignersForTransactions).not.toHaveBeenCalled();
      expect(transactionsService.getTransactionApproversForTransactions).not.toHaveBeenCalled();
      expect(transactionsService.getTransactionObserversForTransactions).not.toHaveBeenCalled();
    });

    it('should fetch and map signers, approvers, and observers when full is true', async () => {
      const mockSigners = [
        { transactionId: 10, userId: 1 },
        { transactionId: 11, userId: 2 },
      ];
      const mockApprovers = [{ transactionId: 10, userId: 3 }];
      const mockObservers = [{ transactionId: 11, userId: 4 }];

      dataSource.manager.findOne.mockResolvedValue(mockGroup);
      dataSource.manager.query.mockResolvedValue(mockRows);
      dataSource.manager.create.mockImplementation((_, data) => ({ ...data }));

      transactionsService.getTransactionSignersForTransactions.mockResolvedValue(mockSigners as any);
      transactionsService.getTransactionApproversForTransactions.mockResolvedValue(mockApprovers as any);
      transactionsService.getTransactionObserversForTransactions.mockResolvedValue(mockObservers as any);

      const result = await service.getTransactionGroup(userWithKeys, 1, true);

      expect(transactionsService.getTransactionSignersForTransactions).toHaveBeenCalledWith([10, 11]);
      expect(transactionsService.getTransactionApproversForTransactions).toHaveBeenCalledWith([10, 11]);
      expect(transactionsService.getTransactionObserversForTransactions).toHaveBeenCalledWith([10, 11]);

      const item1 = result.groupItems.find(i => i.transactionId === 10);
      const item2 = result.groupItems.find(i => i.transactionId === 11);

      expect(item1.transaction.signers).toEqual([{ transactionId: 10, userId: 1 }]);
      expect(item1.transaction.approvers).toEqual([{ transactionId: 10, userId: 3 }]);
      expect(item1.transaction.observers).toEqual([]);

      expect(item2.transaction.signers).toEqual([{ transactionId: 11, userId: 2 }]);
      expect(item2.transaction.approvers).toEqual([]);
      expect(item2.transaction.observers).toEqual([{ transactionId: 11, userId: 4 }]);
    });

    it('should default signers/approvers/observers to empty arrays if not found in map', async () => {
      dataSource.manager.findOne.mockResolvedValue(mockGroup);
      dataSource.manager.query.mockResolvedValue([mockRows[0]]);
      dataSource.manager.create.mockImplementation((_, data) => ({ ...data }));

      transactionsService.getTransactionSignersForTransactions.mockResolvedValue([]);
      transactionsService.getTransactionApproversForTransactions.mockResolvedValue([]);
      transactionsService.getTransactionObserversForTransactions.mockResolvedValue([]);

      const result = await service.getTransactionGroup(userWithKeys, 1, true);

      expect(result.groupItems[0].transaction.signers).toEqual([]);
      expect(result.groupItems[0].transaction.approvers).toEqual([]);
      expect(result.groupItems[0].transaction.observers).toEqual([]);
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
