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

  const singleTransaction: Transaction = {
    id: 1,
    name: 'Single test transaction',
    type: TransactionType.ACCOUNT_CREATE,
    description: 'Single test transaction description',
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

  const childTransaction: Transaction = {
    id: 1,
    name: 'Test child transaction',
    type: TransactionType.ACCOUNT_CREATE,
    description: 'Test child  transaction description',
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

  const group: TransactionGroup = {
    id: 0,
    description: 'Test group',
    atomic: true,
    sequential: true,
    createdAt: new Date(),
    groupItems: []
  }

  const groupItem: TransactionGroupItem = {
    seq: 0,
    transactionId: childTransaction.id,
    transaction: singleTransaction,
    group: group,
    groupId: group.id
  }
  group.groupItems = [groupItem];
  childTransaction.groupItem = groupItem;

  const singleTransactionNode = new TransactionNodeDto();
  singleTransactionNode.transactionId = singleTransaction.id;
  singleTransactionNode.groupId = undefined;
  singleTransactionNode.description = singleTransaction.description;
  singleTransactionNode.createdAt = singleTransaction.createdAt.toISOString();
  singleTransactionNode.validStart = singleTransaction.validStart.toISOString();
  singleTransactionNode.updatedAt = singleTransaction.updatedAt.toISOString();
  singleTransactionNode.executedAt = singleTransaction.executedAt?.toISOString();
  singleTransactionNode.status = singleTransaction.status;
  singleTransactionNode.statusCode = singleTransaction.statusCode;
  singleTransactionNode.sdkTransactionId = singleTransaction.transactionId;
  singleTransactionNode.transactionType = singleTransaction.type;
  singleTransactionNode.groupItemCount = undefined;
  singleTransactionNode.groupCollectedCount = undefined;

  const groupNode = new TransactionNodeDto();
  groupNode.transactionId = undefined;
  groupNode.groupId = group.id;
  groupNode.description = group.description;
  groupNode.createdAt = group.createdAt.toISOString();
  groupNode.validStart = childTransaction.validStart.toISOString();
  groupNode.updatedAt = childTransaction.updatedAt.toISOString();
  groupNode.executedAt = childTransaction.executedAt?.toISOString();
  groupNode.status = childTransaction.status;
  groupNode.statusCode = childTransaction.statusCode;
  groupNode.sdkTransactionId = undefined;
  groupNode.transactionType = undefined;
  groupNode.groupItemCount = 1;
  groupNode.groupCollectedCount = 1;

  describe('getHistoryTransactions', () => {
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
        items: [singleTransaction, childTransaction],
        page: 1,
        size: 10,
      };
      transactionsService.getTransactionsToApprove.mockResolvedValue(transactions);
      transactionGroupsService.getTransactionGroup.mockResolvedValue(group);

      const r = await service.getTransactionNodes(user, TransactionNodeCollection.READY_FOR_REVIEW);

      expect(r).toStrictEqual([groupNode, singleTransactionNode]);
    });

    it('TransactionNodeCollection.READY_TO_SIGN => getTransactionsToSign()', async () => {
      const result = {
        totalItems: 1,
        items: [
          { transaction: singleTransaction, keysToSign: []},
          { transaction: childTransaction, keysToSign: []},
        ],
        page: 1,
        size: 10,
      };

      transactionsService.getTransactionsToSign.mockResolvedValue(result);
      transactionGroupsService.getTransactionGroup.mockResolvedValue(group);

      const r = await service.getTransactionNodes(user, TransactionNodeCollection.READY_TO_SIGN);

      expect(r).toStrictEqual([groupNode, singleTransactionNode]);
    });

    it('TransactionNodeCollection.READY_FOR_EXECUTION => getTransactions(TransactionStatus.WAITING_FOR_EXECUTION)', async () => {
      const result = {
        totalItems: 1,
        items: [singleTransaction, childTransaction],
        page: 1,
        size: 10,
      };

      transactionsService.getTransactions.mockResolvedValue(result);
      transactionGroupsService.getTransactionGroup.mockResolvedValue(group);

      const r = await service.getTransactionNodes(user, TransactionNodeCollection.READY_FOR_EXECUTION);

      expect(r).toStrictEqual([groupNode, singleTransactionNode]);
    });

    it('TransactionNodeCollection.READY_FOR_EXECUTION => getTransactions(TransactionStatus.WAITING_FOR_SIGNATURES)', async () => {
      const result = {
        totalItems: 1,
        items: [singleTransaction, childTransaction],
        page: 1,
        size: 10,
      };

      transactionsService.getTransactions.mockResolvedValue(result);
      transactionGroupsService.getTransactionGroup.mockResolvedValue(group);

      const r = await service.getTransactionNodes(user, TransactionNodeCollection.READY_FOR_EXECUTION);

      expect(r).toStrictEqual([groupNode, singleTransactionNode]);
    });

    it('TransactionNodeCollection.HISTORY => getHistoryTransactions()', async () => {
      const result = {
        totalItems: 1,
        items: [singleTransaction, childTransaction],
        page: 1,
        size: 10,
      };

      transactionsService.getHistoryTransactions.mockResolvedValue(result);
      transactionGroupsService.getTransactionGroup.mockResolvedValue(group);

      const r = await service.getTransactionNodes(user, TransactionNodeCollection.HISTORY);

      expect(r).toStrictEqual([groupNode, singleTransactionNode]);
    });
  });
});
