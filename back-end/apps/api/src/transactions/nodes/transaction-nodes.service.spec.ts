import { TransactionNodeCollection } from '../dto/ITransactionNode';
import { mockDeep } from 'jest-mock-extended';
import {
  TransactionNodesService,
} from './transaction-nodes.service';
import {
  TransactionStatus,
  TransactionType,
  User,
  UserKey,
  UserStatus,
} from '@entities';
import { Test, TestingModule } from '@nestjs/testing';
import {
  attachKeys,
  getTransactionNodesForUser,
  SqlBuilderService,
} from '@app/common';
import { EntityManager } from 'typeorm';
import { TransactionNodeDto } from '../dto';
import { TRANSACTION_STATUS_COLLECTIONS } from './transaction-node-collections.constants';

jest.mock('@app/common', () => {
  return {
    ...jest.requireActual('@app/common'),
    attachKeys: jest.fn(),
    getTransactionNodesForUser: jest.fn(),
  };
});

describe('TransactionNodesService', () => {
  let service: TransactionNodesService;

  const entityManager = mockDeep<EntityManager>();
  const sqlBuilderService = mockDeep<SqlBuilderService>();

  const user: User = {
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

  const userKey: UserKey = {
    id: 1,
    userId: 1,
    mnemonicHash: 'someHashValue',
    index: 1,
    publicKey: 'some public key',
    user: user,
    deletedAt: undefined,
    createdTransactions: [],
    approvedTransactions: [],
    signedTransactions: [],
  };

  //
  // Transactions
  //

  const TEST_NETWORK = 'testnet';

  const singleTransactionRow1 = {
    transaction_id: 1,
    group_id: null,
    description: 'Single test transaction 1',
    created_at: new Date('2025-01-01T00:00:00Z'),
    valid_start: new Date('2025-01-01T00:01:00Z'),
    updated_at: new Date('2025-01-01T00:02:00Z'),
    executed_at: null,
    status: TransactionStatus.NEW,
    status_code: null,
    sdk_transaction_id: '0.0.123@15648433.112315',
    transaction_type: TransactionType.ACCOUNT_CREATE,
    is_manual: false,
    group_item_count: null,
    group_collected_count: null,
  };

  const singleTransactionRow2 = {
    transaction_id: 2,
    group_id: null,
    description: 'Single test transaction 2',
    created_at: new Date('2025-01-02T00:00:00Z'),
    valid_start: new Date('2025-01-02T00:01:00Z'),
    updated_at: new Date('2025-01-02T00:02:00Z'),
    executed_at: new Date('2025-01-02T00:03:00Z'),
    status: TransactionStatus.WAITING_FOR_EXECUTION,
    status_code: 22,
    sdk_transaction_id: '0.0.123@15648433.315112',
    transaction_type: TransactionType.ACCOUNT_UPDATE,
    is_manual: false,
    group_item_count: null,
    group_collected_count: null,
  };

  const groupRow1 = {
    transaction_id: null,
    group_id: 1,
    description: 'Test group 1',
    created_at: new Date('2025-01-03T00:00:00Z'),
    valid_start: new Date('2025-01-03T00:01:00Z'),
    updated_at: new Date('2025-01-03T00:02:00Z'),
    executed_at: new Date('2025-01-03T00:03:00Z'),
    status: TransactionStatus.EXECUTED,
    status_code: 22,
    sdk_transaction_id: null,
    transaction_type: null,
    is_manual: null,
    group_item_count: 2,
    group_collected_count: 2,
  };

  const groupRow2 = {
    transaction_id: null,
    group_id: 2,
    description: 'Test group 2',
    created_at: new Date('2025-01-04T00:00:00Z'),
    valid_start: new Date('2025-01-04T00:01:00Z'),
    updated_at: new Date('2025-01-04T00:02:00Z'),
    executed_at: null,
    status: TransactionStatus.FAILED,
    status_code: 42,
    sdk_transaction_id: null,
    transaction_type: null,
    is_manual: null,
    group_item_count: 2,
    group_collected_count: 1,
  };

  const groupRow3 = {
    transaction_id: null,
    group_id: 3,
    description: 'Test group 3',
    created_at: new Date('2025-01-05T00:00:00Z'),
    valid_start: new Date('2025-01-05T00:01:00Z'),
    updated_at: new Date('2025-01-05T00:02:00Z'),
    executed_at: null,
    status: TransactionStatus.WAITING_FOR_SIGNATURES,
    status_code: null,
    sdk_transaction_id: null,
    transaction_type: null,
    is_manual: null,
    group_item_count: 1,
    group_collected_count: 1,
  };

  //
  // Nodes
  //

  const singleTransactionNode1 = new TransactionNodeDto();
  singleTransactionNode1.transactionId = singleTransactionRow1.transaction_id;
  singleTransactionNode1.groupId = undefined;
  singleTransactionNode1.description = singleTransactionRow1.description;
  singleTransactionNode1.createdAt = singleTransactionRow1.created_at.toISOString();
  singleTransactionNode1.validStart = singleTransactionRow1.valid_start.toISOString();
  singleTransactionNode1.updatedAt = singleTransactionRow1.updated_at.toISOString();
  singleTransactionNode1.executedAt = singleTransactionRow1.executed_at?.toISOString();
  singleTransactionNode1.status = singleTransactionRow1.status;
  singleTransactionNode1.statusCode = singleTransactionRow1.status_code;
  singleTransactionNode1.sdkTransactionId = singleTransactionRow1.sdk_transaction_id;
  singleTransactionNode1.transactionType = singleTransactionRow1.transaction_type;
  singleTransactionNode1.isManual = singleTransactionRow1.is_manual;
  singleTransactionNode1.groupItemCount = undefined;
  singleTransactionNode1.groupCollectedCount = undefined;

  const singleTransactionNode2 = new TransactionNodeDto();
  singleTransactionNode2.transactionId = singleTransactionRow2.transaction_id;
  singleTransactionNode2.groupId = undefined;
  singleTransactionNode2.description = singleTransactionRow2.description;
  singleTransactionNode2.createdAt = singleTransactionRow2.created_at.toISOString();
  singleTransactionNode2.validStart = singleTransactionRow2.valid_start.toISOString();
  singleTransactionNode2.updatedAt = singleTransactionRow2.updated_at.toISOString();
  singleTransactionNode2.executedAt = singleTransactionRow2.executed_at?.toISOString();
  singleTransactionNode2.status = singleTransactionRow2.status;
  singleTransactionNode2.statusCode = singleTransactionRow2.status_code;
  singleTransactionNode2.sdkTransactionId = singleTransactionRow2.sdk_transaction_id;
  singleTransactionNode2.transactionType = singleTransactionRow2.transaction_type;
  singleTransactionNode2.isManual = singleTransactionRow2.is_manual;
  singleTransactionNode2.groupItemCount = undefined;
  singleTransactionNode2.groupCollectedCount = undefined;

  const groupNode1 = new TransactionNodeDto();
  groupNode1.transactionId = undefined;
  groupNode1.groupId = groupRow1.group_id;
  groupNode1.description = groupRow1.description;
  groupNode1.createdAt = groupRow1.created_at.toISOString();
  groupNode1.validStart = groupRow1.valid_start.toISOString();
  groupNode1.updatedAt = groupRow1.updated_at.toISOString();
  groupNode1.executedAt = groupRow1.executed_at?.toISOString();
  groupNode1.status = groupRow1.status;
  groupNode1.statusCode = groupRow1.status_code;
  groupNode1.sdkTransactionId = undefined;
  groupNode1.transactionType = undefined;
  groupNode1.isManual = undefined;
  groupNode1.groupItemCount = 2;
  groupNode1.groupCollectedCount = 2;

  const groupNode2 = new TransactionNodeDto();
  groupNode2.transactionId = undefined;
  groupNode2.groupId = groupRow2.group_id;
  groupNode2.description = groupRow2.description;
  groupNode2.createdAt = groupRow2.created_at.toISOString();
  groupNode2.validStart = groupRow2.valid_start.toISOString();
  groupNode2.updatedAt = groupRow2.updated_at.toISOString();
  groupNode2.executedAt = groupRow2.executed_at?.toISOString();
  groupNode2.status = undefined;
  groupNode2.statusCode = undefined;
  groupNode2.sdkTransactionId = undefined;
  groupNode2.transactionType = undefined;
  groupNode2.isManual = undefined;
  groupNode2.groupItemCount = 2;
  groupNode2.groupCollectedCount = 2;

  const groupNode3 = new TransactionNodeDto();
  groupNode3.transactionId = undefined;
  groupNode3.groupId = groupRow3.group_id;
  groupNode3.description = groupRow3.description;
  groupNode3.createdAt = groupRow3.created_at.toISOString();
  groupNode3.validStart = groupRow3.valid_start.toISOString();
  groupNode3.updatedAt = groupRow3.updated_at.toISOString();
  groupNode3.executedAt = groupRow3.executed_at?.toISOString();
  groupNode3.status = groupRow3.status;
  groupNode3.statusCode = groupRow3.status_code;
  groupNode3.sdkTransactionId = undefined;
  groupNode3.transactionType = undefined;
  groupNode3.isManual = undefined;
  groupNode3.groupItemCount = 1;
  groupNode3.groupCollectedCount = 1;

  const allNodes = [
    singleTransactionNode1,
    singleTransactionNode2,
    groupNode1,
    groupNode2,
    groupNode3,
  ];

  describe('getTransactionNodes()', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TransactionNodesService,
          {
            provide: EntityManager,
            useValue: entityManager,
          },
          {
            provide: SqlBuilderService,
            useValue: sqlBuilderService,
          },
        ],
      }).compile();

      service = module.get<TransactionNodesService>(TransactionNodesService);

      jest.resetAllMocks();

      // Default mock implementation for attachKeys
      (attachKeys as jest.Mock).mockImplementation((user) => user.keys.push(userKey));
    });

    it('TransactionNodeCollection.READY_FOR_REVIEW => getTransactionsToApprove()', async () => {
      const mockQuery = { text: 'SELECT * FROM transactions...', values: [] };

      (getTransactionNodesForUser as jest.Mock).mockReturnValue(mockQuery);
      entityManager.query.mockResolvedValue([
        singleTransactionRow1,
        groupRow3,
      ]);

      const result = await service.getTransactionNodes(
        user,
        TransactionNodeCollection.READY_FOR_REVIEW,
        TEST_NETWORK,
        [],
        [],
      );

      expect(result).toEqual([
        singleTransactionNode1,
        groupNode3,
      ]);

      expect(getTransactionNodesForUser).toHaveBeenCalledWith(
        sqlBuilderService,
        user,
        { approver: true },
        {
          statuses: TRANSACTION_STATUS_COLLECTIONS.READY_FOR_REVIEW,
          mirrorNetwork: TEST_NETWORK,
        }
      );

      expect(entityManager.query).toHaveBeenCalledWith(mockQuery.text, mockQuery.values);
    });

    it('TransactionNodeCollection.READY_TO_SIGN => getTransactionsToSign()', async () => {
      const rows = [
        {
          transaction_id: 123,
          group_id: null,
          description: 'Test tx',
          created_at: new Date('2025-01-01T00:00:00Z'),
          valid_start: new Date('2025-01-01T00:01:00Z'),
          updated_at: new Date('2025-01-01T00:02:00Z'),
          executed_at: null,
          status: 'WAITING_FOR_SIGNATURES',
          status_code: null,
          sdk_transaction_id: 'sdk-123',
          transaction_type: 'TRANSFER',
          is_manual: false,
          group_item_count: null,
          group_collected_count: null,
        },
      ];
      const expected: TransactionNodeDto[] = [
        {
          description: 'Test tx',
          createdAt: '2025-01-01T00:00:00.000Z',
          validStart: '2025-01-01T00:01:00.000Z',
          updatedAt: '2025-01-01T00:02:00.000Z',
          executedAt: undefined,
          status: 'WAITING_FOR_SIGNATURES',
          statusCode: null,

          transactionId: 123,
          groupId: undefined,
          sdkTransactionId: 'sdk-123',
          transactionType: 'TRANSFER',
          isManual: false,
          groupItemCount: undefined,
          groupCollectedCount: undefined,
        },
      ];

      const mockQuery = { text: 'SELECT * FROM...', values: [] };

      (attachKeys as jest.Mock).mockImplementation((user, entityManager) => user.keys.push(userKey));

      // Mock getTransactionNodesForUser to return a query object
      (getTransactionNodesForUser as jest.Mock).mockReturnValue(mockQuery);

      // Mock entityManager.query to return the rows
      entityManager.query.mockResolvedValue(rows);

      const result = await service.getTransactionNodes(
        user,
        TransactionNodeCollection.READY_TO_SIGN,
        TEST_NETWORK,
        [],
        [],
      );

      expect(result).toEqual(expected);

      // Verify getTransactionNodesForUser was called with correct parameters
      expect(getTransactionNodesForUser)
        .toHaveBeenCalledWith(
          sqlBuilderService,
          user,
          { signer: true },
          {
            statuses: TRANSACTION_STATUS_COLLECTIONS.READY_TO_SIGN,
            mirrorNetwork: TEST_NETWORK,
          }
        );

      // Verify entityManager.query was called with the query
      expect(entityManager.query).toHaveBeenCalledWith(mockQuery.text, mockQuery.values);
    });

    it('TransactionNodeCollection.READY_FOR_EXECUTION => getTransactions(TransactionStatus.WAITING_FOR_EXECUTION)', async () => {
      const r = await service.getTransactionNodes(
        user,
        TransactionNodeCollection.READY_FOR_EXECUTION,
        TEST_NETWORK,
        [],
        [],
      );

      expect(r).toStrictEqual(allNodes);
    });

    it('TransactionNodeCollection.IN_PROGRESS => getTransactions(TransactionStatus.WAITING_FOR_SIGNATURES)', async () => {
      const r = await service.getTransactionNodes(
        user,
        TransactionNodeCollection.IN_PROGRESS,
        TEST_NETWORK,
        [],
        [],
      );

      expect(r).toStrictEqual(allNodes);
    });

    it('TransactionNodeCollection.HISTORY => getHistoryTransactions()', async () => {
      const r = await service.getTransactionNodes(
        user,
        TransactionNodeCollection.HISTORY,
        TEST_NETWORK,
        [],
        [],
      );

      expect(r).toStrictEqual(allNodes);
    });

    it('status filtering is effective', async () => {
      const r = await service.getTransactionNodes(
        user,
        TransactionNodeCollection.HISTORY,
        TEST_NETWORK,
        [TransactionStatus.EXPIRED],
        [],
      );

      expect(r).toStrictEqual([]);
    });

    it('transaction type filtering is effective', async () => {
      const r = await service.getTransactionNodes(
        user,
        TransactionNodeCollection.HISTORY,
        TEST_NETWORK,
        [],
        [TransactionType.FILE_APPEND],
      );

      expect(r).toStrictEqual([]);
    });
  });
});
