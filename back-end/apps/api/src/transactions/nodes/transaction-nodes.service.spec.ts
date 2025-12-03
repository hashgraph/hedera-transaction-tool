import { TransactionNodeCollection } from '../dto/ITransactionNode';
import { mock, mockDeep } from 'jest-mock-extended';
import { TransactionsService } from '../transactions.service';
import { TransactionNodesService } from './transaction-nodes.service';
import {
  Transaction, TransactionGroup,
  TransactionGroupItem,
  TransactionStatus,
  TransactionType,
  User,
  UserStatus,
} from '@entities';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CHAIN_SERVICE,
  MirrorNodeService,
  NOTIFICATIONS_SERVICE,
  SchedulerService,
} from '@app/common';
import { ApproversService } from '../approvers';
import { EntityManager, Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { TransactionGroupsService } from '../groups';
import { TransactionNodeDto } from '../dto';

describe('TransactionNodesService', () => {
  let service: TransactionNodesService;

  const transactionsRepo = mockDeep<Repository<Transaction>>();
  const transactionGroupsService = mockDeep<TransactionGroupsService>();
  const transactionsService = mockDeep<TransactionsService>();
  const chainService = mock<ClientProxy>();
  const notificationsService = mock<ClientProxy>();
  const approversService = mock<ApproversService>();
  const mirrorNodeService = mock<MirrorNodeService>();
  const schedulerService = mock<SchedulerService>();
  const entityManager = mockDeep<EntityManager>();

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
  };

  const singleTransaction1: Transaction = {
    id: 1,
    name: 'Single test transaction 1',
    type: TransactionType.ACCOUNT_CREATE,
    description: 'Single test transaction description 1',
    transactionId: '0.0.123@15648433.112315',
    validStart: new Date(),
    transactionHash: '5a381df6a8s4f9e0asd8f46aw8e1f0asdd',
    transactionBytes: Buffer.from(
      '0x0a8b012a88010a83010a170a0b08a1b78ab20610c0c8e722120608001000187b180012060800100018021880c2d72f220308b401320274785a520a221220d3ef6b5fcf45025d011c18bea660cc0add0d35d4f6c9d4a24e70c4ceba49224b1080c0d590830130ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a0361636370008801011200',
    ),
    unsignedTransactionBytes: Buffer.from(
      '0x0a8b012a88010a83010a170a0b08a1b78ab20610c0c8e722120608001000187b180012060800100018021880c2d72f220308b401320274785a520a221220d3ef6b5fcf45025d011c18bea660cc0add0d35d4f6c9d4a24e70c4ceba49224b1080c0d590830130ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a0361636370008801011200',
    ),
    signature: Buffer.from(
      '0xfb228df4984c1d7bd0d6a915683350c2179f5436fc242d394a625f805c25061a50d9922448e88891a2dd6f9933f155c4b3a47195cfbf54a04597bd67ec27670f',
    ),
    status: TransactionStatus.NEW,
    mirrorNetwork: 'testnet',
    isManual: false,
    cutoffAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    creatorKey: {
      id: 1,
      publicKey: 'publicKey',
      mnemonicHash: 'mnemonicHash',
      index: 1,
      user: user,
      userId: user.id,
      deletedAt: null,
      createdTransactions: [],
      approvedTransactions: [],
      signedTransactions: [],
    },
    signers: [],
    approvers: [],
    observers: [],
    comments: [],
    groupItem: null,
  };

  const singleTransaction2: Transaction = {
    id: 2,
    name: 'Single test transaction 2',
    type: TransactionType.ACCOUNT_UPDATE,
    description: 'Single test transaction description 2',
    transactionId: '0.0.123@15648433.315112',
    validStart: new Date(),
    transactionHash: '5a381df6a8s4f9e0asd8f46aw8e1f0asdd',
    transactionBytes: Buffer.from(
      '0x0a8b012a88010a83010a170a0b08a1b78ab20610c0c8e722120608001000187b180012060800100018021880c2d72f220308b401320274785a520a221220d3ef6b5fcf45025d011c18bea660cc0add0d35d4f6c9d4a24e70c4ceba49224b1080c0d590830130ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a0361636370008801011200',
    ),
    unsignedTransactionBytes: Buffer.from(
      '0x0a8b012a88010a83010a170a0b08a1b78ab20610c0c8e722120608001000187b180012060800100018021880c2d72f220308b401320274785a520a221220d3ef6b5fcf45025d011c18bea660cc0add0d35d4f6c9d4a24e70c4ceba49224b1080c0d590830130ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a0361636370008801011200',
    ),
    signature: Buffer.from(
      '0xfb228df4984c1d7bd0d6a915683350c2179f5436fc242d394a625f805c25061a50d9922448e88891a2dd6f9933f155c4b3a47195cfbf54a04597bd67ec27670f',
    ),
    status: TransactionStatus.NEW,
    mirrorNetwork: 'testnet',
    isManual: false,
    cutoffAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    creatorKey: {
      id: 1,
      publicKey: 'publicKey',
      mnemonicHash: 'mnemonicHash',
      index: 1,
      user: user,
      userId: user.id,
      deletedAt: null,
      createdTransactions: [],
      approvedTransactions: [],
      signedTransactions: [],
    },
    signers: [],
    approvers: [],
    observers: [],
    comments: [],
    groupItem: null,
  };

  const childTransactionDate1 = Date.now();

  const childTransaction1: Transaction = {
    id: 1,
    name: 'Test child transaction 1',
    type: TransactionType.ACCOUNT_CREATE,
    description: 'Test child  transaction description 1',
    transactionId: '0.0.123@15648433.112315',
    validStart: new Date(childTransactionDate1 + 2000),
    transactionHash: '5a381df6a8s4f9e0asd8f46aw8e1f0asdd',
    transactionBytes: Buffer.from(
      '0x0a8b012a88010a83010a170a0b08a1b78ab20610c0c8e722120608001000187b180012060800100018021880c2d72f220308b401320274785a520a221220d3ef6b5fcf45025d011c18bea660cc0add0d35d4f6c9d4a24e70c4ceba49224b1080c0d590830130ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a0361636370008801011200',
    ),
    unsignedTransactionBytes: Buffer.from(
      '0x0a8b012a88010a83010a170a0b08a1b78ab20610c0c8e722120608001000187b180012060800100018021880c2d72f220308b401320274785a520a221220d3ef6b5fcf45025d011c18bea660cc0add0d35d4f6c9d4a24e70c4ceba49224b1080c0d590830130ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a0361636370008801011200',
    ),
    signature: Buffer.from(
      '0xfb228df4984c1d7bd0d6a915683350c2179f5436fc242d394a625f805c25061a50d9922448e88891a2dd6f9933f155c4b3a47195cfbf54a04597bd67ec27670f',
    ),
    status: TransactionStatus.NEW,
    mirrorNetwork: 'testnet',
    isManual: false,
    cutoffAt: new Date(childTransactionDate1),
    createdAt: new Date(childTransactionDate1),
    updatedAt: new Date(childTransactionDate1 + 1000),
    deletedAt: null,
    creatorKey: {
      id: 1,
      publicKey: 'publicKey',
      mnemonicHash: 'mnemonicHash',
      index: 1,
      user: user,
      userId: user.id,
      deletedAt: null,
      createdTransactions: [],
      approvedTransactions: [],
      signedTransactions: [],
    },
    signers: [],
    approvers: [],
    observers: [],
    comments: [],
    groupItem: null,
  };

  const childTransactionDate2 = childTransactionDate1 + 4000;

  const childTransaction2: Transaction = {
    id: 1,
    name: 'Test child transaction 2',
    type: TransactionType.ACCOUNT_CREATE,
    description: 'Test child  transaction description 2',
    transactionId: '0.0.123@15648433.315112',
    validStart: new Date(childTransactionDate2 + 3000),
    transactionHash: '5a381df6a8s4f9e0asd8f46aw8e1f0asdd',
    transactionBytes: Buffer.from(
      '0x0a8b012a88010a83010a170a0b08a1b78ab20610c0c8e722120608001000187b180012060800100018021880c2d72f220308b401320274785a520a221220d3ef6b5fcf45025d011c18bea660cc0add0d35d4f6c9d4a24e70c4ceba49224b1080c0d590830130ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a0361636370008801011200',
    ),
    unsignedTransactionBytes: Buffer.from(
      '0x0a8b012a88010a83010a170a0b08a1b78ab20610c0c8e722120608001000187b180012060800100018021880c2d72f220308b401320274785a520a221220d3ef6b5fcf45025d011c18bea660cc0add0d35d4f6c9d4a24e70c4ceba49224b1080c0d590830130ffffffffffffffff7f38ffffffffffffffff7f40004a050880ceda036a0361636370008801011200',
    ),
    signature: Buffer.from(
      '0xfb228df4984c1d7bd0d6a915683350c2179f5436fc242d394a625f805c25061a50d9922448e88891a2dd6f9933f155c4b3a47195cfbf54a04597bd67ec27670f',
    ),
    status: TransactionStatus.NEW,
    mirrorNetwork: 'testnet',
    isManual: false,
    cutoffAt: new Date(childTransactionDate2),
    createdAt: new Date(childTransactionDate2),
    updatedAt: new Date(childTransactionDate2 + 2000),
    deletedAt: null,
    creatorKey: {
      id: 1,
      publicKey: 'publicKey',
      mnemonicHash: 'mnemonicHash',
      index: 1,
      user: user,
      userId: user.id,
      deletedAt: null,
      createdTransactions: [],
      approvedTransactions: [],
      signedTransactions: [],
    },
    signers: [],
    approvers: [],
    observers: [],
    comments: [],
    groupItem: null,
  };

  const group: TransactionGroup = {
    id: 0,
    description: 'Test group',
    atomic: true,
    sequential: true,
    createdAt: new Date(),
    groupItems: []
  }

  const groupItem1: TransactionGroupItem = {
    seq: 0,
    transactionId: childTransaction1.id,
    transaction: childTransaction1,
    group: group,
    groupId: group.id
  }
  childTransaction1.groupItem = groupItem1;

  const groupItem2: TransactionGroupItem = {
    seq: 0,
    transactionId: childTransaction2.id,
    transaction: childTransaction2,
    group: group,
    groupId: group.id
  }
  childTransaction2.groupItem = groupItem2;

  group.groupItems = [groupItem1, groupItem2];

  const allTransactions = [
    singleTransaction1,
    singleTransaction2,
    childTransaction1,
    childTransaction2
  ];


  const singleTransactionNode1 = new TransactionNodeDto();
  singleTransactionNode1.transactionId = singleTransaction1.id;
  singleTransactionNode1.groupId = undefined;
  singleTransactionNode1.description = singleTransaction1.description;
  singleTransactionNode1.createdAt = singleTransaction1.createdAt.toISOString();
  singleTransactionNode1.validStart = singleTransaction1.validStart.toISOString();
  singleTransactionNode1.updatedAt = singleTransaction1.updatedAt.toISOString();
  singleTransactionNode1.executedAt = singleTransaction1.executedAt?.toISOString();
  singleTransactionNode1.status = singleTransaction1.status;
  singleTransactionNode1.statusCode = singleTransaction1.statusCode;
  singleTransactionNode1.sdkTransactionId = singleTransaction1.transactionId;
  singleTransactionNode1.transactionType = singleTransaction1.type;
  singleTransactionNode1.groupItemCount = undefined;
  singleTransactionNode1.groupCollectedCount = undefined;

  const singleTransactionNode2 = new TransactionNodeDto();
  singleTransactionNode2.transactionId = singleTransaction2.id;
  singleTransactionNode2.groupId = undefined;
  singleTransactionNode2.description = singleTransaction2.description;
  singleTransactionNode2.createdAt = singleTransaction2.createdAt.toISOString();
  singleTransactionNode2.validStart = singleTransaction2.validStart.toISOString();
  singleTransactionNode2.updatedAt = singleTransaction2.updatedAt.toISOString();
  singleTransactionNode2.executedAt = singleTransaction2.executedAt?.toISOString();
  singleTransactionNode2.status = singleTransaction2.status;
  singleTransactionNode2.statusCode = singleTransaction2.statusCode;
  singleTransactionNode2.sdkTransactionId = singleTransaction2.transactionId;
  singleTransactionNode2.transactionType = singleTransaction2.type;
  singleTransactionNode2.groupItemCount = undefined;
  singleTransactionNode2.groupCollectedCount = undefined;

  const groupNode = new TransactionNodeDto();
  groupNode.transactionId = undefined;
  groupNode.groupId = group.id;
  groupNode.description = group.description;
  groupNode.createdAt = group.createdAt.toISOString();
  groupNode.validStart = childTransaction1.validStart.toISOString();
  groupNode.updatedAt = childTransaction2.updatedAt.toISOString();
  groupNode.executedAt = childTransaction2.executedAt?.toISOString();
  groupNode.status = childTransaction1.status;
  groupNode.statusCode = childTransaction1.statusCode;
  groupNode.sdkTransactionId = undefined;
  groupNode.transactionType = undefined;
  groupNode.groupItemCount = 2;
  groupNode.groupCollectedCount = 2;

  const allNodes = [
    groupNode,
    singleTransactionNode1,
    singleTransactionNode2,
  ];

  describe('getTransactionNodes()', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TransactionNodesService,
          {
            provide: TransactionGroupsService,
            useValue: transactionGroupsService,
          },
          {
            provide: TransactionsService,
            useValue: transactionsService,
          },
          {
            provide: getRepositoryToken(Transaction),
            useValue: transactionsRepo,
          },
          {
            provide: NOTIFICATIONS_SERVICE,
            useValue: notificationsService,
          },
          {
            provide: CHAIN_SERVICE,
            useValue: chainService,
          },
          {
            provide: ApproversService,
            useValue: approversService,
          },
          {
            provide: MirrorNodeService,
            useValue: mirrorNodeService,
          },
          {
            provide: EntityManager,
            useValue: entityManager,
          },
          {
            provide: SchedulerService,
            useValue: schedulerService,
          },
        ],
      }).compile();

      service = module.get<TransactionNodesService>(TransactionNodesService);

      jest.resetAllMocks();
    });

    it('TransactionNodeCollection.READY_FOR_REVIEW => getTransactionsToApprove()', async () => {
      const transactions = {
        totalItems: 1,
        items: allTransactions,
        page: 1,
        size: 10,
      };
      transactionsService.getTransactionsToApprove.mockResolvedValue(transactions);
      transactionGroupsService.getTransactionGroup.mockResolvedValue(group);

      const r = await service.getTransactionNodes(user, TransactionNodeCollection.READY_FOR_REVIEW);

      expect(r).toStrictEqual(allNodes);
    });

    it('TransactionNodeCollection.READY_TO_SIGN => getTransactionsToSign()', async () => {
      const result = {
        totalItems: 1,
        items: [
          { transaction: singleTransaction1, keysToSign: []},
          { transaction: singleTransaction2, keysToSign: []},
          { transaction: childTransaction1, keysToSign: []},
          { transaction: childTransaction2, keysToSign: []},
        ],
        page: 1,
        size: 10,
      };

      transactionsService.getTransactionsToSign.mockResolvedValue(result);
      transactionGroupsService.getTransactionGroup.mockResolvedValue(group);

      const r = await service.getTransactionNodes(user, TransactionNodeCollection.READY_TO_SIGN);

      expect(r).toStrictEqual(allNodes);
    });

    it('TransactionNodeCollection.READY_FOR_EXECUTION => getTransactions(TransactionStatus.WAITING_FOR_EXECUTION)', async () => {
      const result = {
        totalItems: 1,
        items: allTransactions,
        page: 1,
        size: 10,
      };

      transactionsService.getTransactions.mockResolvedValue(result);
      transactionGroupsService.getTransactionGroup.mockResolvedValue(group);

      const r = await service.getTransactionNodes(user, TransactionNodeCollection.READY_FOR_EXECUTION);

      expect(r).toStrictEqual(allNodes);
    });

    it('TransactionNodeCollection.IN_PROGRESS => getTransactions(TransactionStatus.WAITING_FOR_SIGNATURES)', async () => {
      const result = {
        totalItems: 1,
        items: allTransactions,
        page: 1,
        size: 10,
      };

      transactionsService.getTransactions.mockResolvedValue(result);
      transactionGroupsService.getTransactionGroup.mockResolvedValue(group);

      const r = await service.getTransactionNodes(user, TransactionNodeCollection.IN_PROGRESS);

      expect(r).toStrictEqual(allNodes);
    });

    it('TransactionNodeCollection.HISTORY => getHistoryTransactions()', async () => {
      const result = {
        totalItems: 1,
        items: allTransactions,
        page: 1,
        size: 10,
      };

      transactionsService.getHistoryTransactions.mockResolvedValue(result);
      transactionGroupsService.getTransactionGroup.mockResolvedValue(group);

      const r = await service.getTransactionNodes(user, TransactionNodeCollection.HISTORY);

      expect(r).toStrictEqual(allNodes);
    });
  });
});
