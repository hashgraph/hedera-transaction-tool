import { TransactionNodeCollection } from '../dto/ITransactionNode';
import { mock, mockDeep } from 'jest-mock-extended';
import { TransactionsService } from '../transactions.service';
import {
  maxExecutedAt,
  maxUpdatedAt,
  minValidStart,
  TransactionNodesService,
} from './transaction-nodes.service';
import {
  Transaction,
  TransactionGroup,
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
  Filtering,
  MirrorNodeService,
  NOTIFICATIONS_SERVICE,
  PaginatedResourceDto,
  Pagination,
  SchedulerService,
  Sorting,
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

  //
  // Transactions
  //

  const TEST_NETWORK = 'testnet';

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
    transactionAccounts: [],
    transactionNodes: [],
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
    status: TransactionStatus.EXECUTED, // different from singleTransaction1 to improve code coverage
    mirrorNetwork: TEST_NETWORK,
    isManual: false,
    cutoffAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    executedAt: new Date(),
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
    transactionAccounts: [],
    transactionNodes: [],
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
    status: TransactionStatus.EXECUTED,
    statusCode: 22,
    mirrorNetwork: TEST_NETWORK,
    isManual: false,
    cutoffAt: new Date(childTransactionDate1),
    createdAt: new Date(childTransactionDate1),
    updatedAt: new Date(childTransactionDate1 + 1000),
    executedAt: new Date(childTransactionDate1 + 2100),
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
    transactionAccounts: [],
    transactionNodes: [],
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
    status: TransactionStatus.EXECUTED,
    statusCode: 22,
    mirrorNetwork: TEST_NETWORK,
    isManual: false,
    cutoffAt: new Date(childTransactionDate2),
    createdAt: new Date(childTransactionDate2),
    updatedAt: new Date(childTransactionDate2 + 2000),
    executedAt: new Date(childTransactionDate2 + 3100),
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
    transactionAccounts: [],
    transactionNodes: [],
  };

  const childTransactionDate3 = childTransactionDate2 + 4000;

  const childTransaction3: Transaction = {
    id: 3,
    name: 'Test child transaction 3',
    type: TransactionType.ACCOUNT_CREATE,
    description: 'Test child  transaction description 3',
    transactionId: '0.0.123@15648433.415112',
    validStart: new Date(childTransactionDate3 + 3000),
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
    status: TransactionStatus.EXECUTED,
    statusCode: 22,
    mirrorNetwork: TEST_NETWORK,
    isManual: false,
    cutoffAt: new Date(childTransactionDate3),
    createdAt: new Date(childTransactionDate3),
    updatedAt: new Date(childTransactionDate3 + 2000),
    executedAt: new Date(childTransactionDate3 + 3100),
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
    transactionAccounts: [],
    transactionNodes: [],
  };

  const childTransactionDate4 = childTransactionDate3 + 4000;

  const childTransaction4: Transaction = {
    id: 4,
    name: 'Test child transaction 4',
    type: TransactionType.ACCOUNT_UPDATE,
    description: 'Test child  transaction description 4',
    transactionId: '0.0.123@15648433.515112',
    validStart: new Date(childTransactionDate4 + 3000),
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
    status: TransactionStatus.FAILED,
    statusCode: 42,
    mirrorNetwork: TEST_NETWORK,
    isManual: false,
    cutoffAt: new Date(childTransactionDate4),
    createdAt: new Date(childTransactionDate4),
    updatedAt: new Date(childTransactionDate4 + 2000),
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
    transactionAccounts: [],
    transactionNodes: [],
  };

  const childTransactionDate5 = childTransactionDate4 + 4000;

  const childTransaction5: Transaction = {
    id: 4,
    name: 'Test child transaction 5',
    type: TransactionType.TRANSFER,
    description: 'Test child  transaction description 5',
    transactionId: '0.0.123@15648433.615112',
    validStart: new Date(childTransactionDate5 + 3000),
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
    statusCode: undefined,
    mirrorNetwork: TEST_NETWORK,
    isManual: false,
    cutoffAt: new Date(childTransactionDate5),
    createdAt: new Date(childTransactionDate5),
    updatedAt: new Date(childTransactionDate5 + 2000),
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
    transactionAccounts: [],
    transactionNodes: [],
  };

  //
  // Group 1  { childTransaction1, childTransaction2 }
  //

  const group1: TransactionGroup = {
    id: 1,
    description: 'Test group 1',
    atomic: true,
    sequential: true,
    createdAt: new Date(),
    groupItems: [],
  };

  const groupItem1_1: TransactionGroupItem = {
    seq: 0,
    transactionId: childTransaction1.id,
    transaction: childTransaction1,
    group: group1,
    groupId: group1.id,
  };
  childTransaction1.groupItem = groupItem1_1;

  const groupItem1_2: TransactionGroupItem = {
    seq: 0,
    transactionId: childTransaction2.id,
    transaction: childTransaction2,
    group: group1,
    groupId: group1.id,
  };
  childTransaction2.groupItem = groupItem1_2;

  group1.groupItems = [groupItem1_1, groupItem1_2];

  //
  // Group 2 { childTransaction3, childTransaction4 }
  //

  const group2: TransactionGroup = {
    id: 2,
    description: 'Test group 2',
    atomic: true,
    sequential: true,
    createdAt: new Date(),
    groupItems: [],
  };

  const groupItem2_1: TransactionGroupItem = {
    seq: 0,
    transactionId: childTransaction3.id,
    transaction: childTransaction3,
    group: group2,
    groupId: group2.id,
  };
  childTransaction3.groupItem = groupItem2_1;

  const groupItem2_2: TransactionGroupItem = {
    seq: 1,
    transactionId: childTransaction4.id,
    transaction: childTransaction4,
    group: group2,
    groupId: group2.id,
  };
  childTransaction4.groupItem = groupItem2_2;

  group2.groupItems = [groupItem2_1, groupItem2_2];

  //
  // Group 3 { childTransaction5 }
  //

  const group3: TransactionGroup = {
    id: 3,
    description: 'Test group 3',
    atomic: true,
    sequential: true,
    createdAt: new Date(),
    groupItems: [],
  };

  const groupItem3_1: TransactionGroupItem = {
    seq: 0,
    transactionId: childTransaction5.id,
    transaction: childTransaction5,
    group: group3,
    groupId: group3.id,
  };
  childTransaction5.groupItem = groupItem3_1;

  group3.groupItems = [groupItem3_1];

  //
  // All
  //

  const allTransactions = [
    singleTransaction1,
    singleTransaction2,
    childTransaction1,
    childTransaction2,
    childTransaction4, // 4 before 3 to improve coverage
    childTransaction3,
    childTransaction5,
  ];

  const allTransactionPage = {
    totalItems: allTransactions.length,
    items: allTransactions,
    page: 1,
    size: allTransactions.length,
  };

  const getTransactionGroupMock = async (
    _user: User,
    groupId: number,
  ): Promise<TransactionGroup> => {
    let result: TransactionGroup;
    switch (groupId) {
      case group1.id:
        result = group1;
        break;
      case group2.id:
        result = group2;
        break;
      case group3.id:
        result = group3;
        break;
      default:
        throw Error('Unexpected group id ' + groupId);
    }
    return result;
  };

  //
  // Nodes
  //

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

  const groupNode1 = new TransactionNodeDto();
  groupNode1.transactionId = undefined;
  groupNode1.groupId = group1.id;
  groupNode1.description = group1.description;
  groupNode1.createdAt = group1.createdAt.toISOString();
  groupNode1.validStart = childTransaction1.validStart.toISOString();
  groupNode1.updatedAt = childTransaction2.updatedAt.toISOString();
  groupNode1.executedAt = childTransaction2.executedAt?.toISOString();
  groupNode1.status = childTransaction1.status;
  groupNode1.statusCode = childTransaction1.statusCode;
  groupNode1.sdkTransactionId = undefined;
  groupNode1.transactionType = undefined;
  groupNode1.groupItemCount = 2;
  groupNode1.groupCollectedCount = 2;

  const groupNode2 = new TransactionNodeDto();
  groupNode2.transactionId = undefined;
  groupNode2.groupId = group2.id;
  groupNode2.description = group2.description;
  groupNode2.createdAt = group2.createdAt.toISOString();
  groupNode2.validStart = childTransaction3.validStart.toISOString();
  groupNode2.updatedAt = childTransaction4.updatedAt.toISOString();
  groupNode2.executedAt = childTransaction4.executedAt?.toISOString();
  groupNode2.status = undefined;
  groupNode2.statusCode = undefined;
  groupNode2.sdkTransactionId = undefined;
  groupNode2.transactionType = undefined;
  groupNode2.groupItemCount = 2;
  groupNode2.groupCollectedCount = 2;

  const groupNode3 = new TransactionNodeDto();
  groupNode3.transactionId = undefined;
  groupNode3.groupId = group3.id;
  groupNode3.description = group3.description;
  groupNode3.createdAt = group3.createdAt.toISOString();
  groupNode3.validStart = childTransaction5.validStart.toISOString();
  groupNode3.updatedAt = childTransaction5.updatedAt.toISOString();
  groupNode3.executedAt = childTransaction5.executedAt?.toISOString();
  groupNode3.status = childTransaction5.status;
  groupNode3.statusCode = childTransaction5.statusCode;
  groupNode3.sdkTransactionId = undefined;
  groupNode3.transactionType = undefined;
  groupNode3.groupItemCount = 1;
  groupNode3.groupCollectedCount = 1;

  const allNodes = [
    groupNode1,
    groupNode2,
    groupNode3,
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
      transactionsService.getTransactionsToApprove.mockResolvedValue(allTransactionPage);
      transactionGroupsService.getTransactionGroup.mockImplementation(getTransactionGroupMock);

      const r = await service.getTransactionNodes(
        user,
        TransactionNodeCollection.READY_FOR_REVIEW,
        TEST_NETWORK,
        [],
        [],
      );

      expect(r).toStrictEqual(allNodes);
    });

    it('TransactionNodeCollection.READY_TO_SIGN => getTransactionsToSign()', async () => {
      const result = {
        totalItems: 1,
        items: allTransactions.map(t => {
          return { transaction: t, keysToSign: [] };
        }),
        page: 1,
        size: 10,
      };

      transactionsService.getTransactionsToSign.mockResolvedValue(result);
      transactionGroupsService.getTransactionGroup.mockImplementation(getTransactionGroupMock);

      const r = await service.getTransactionNodes(
        user,
        TransactionNodeCollection.READY_TO_SIGN,
        TEST_NETWORK,
        [],
        [],
      );

      expect(r).toStrictEqual(allNodes);
    });

    it('TransactionNodeCollection.READY_FOR_EXECUTION => getTransactions(TransactionStatus.WAITING_FOR_EXECUTION)', async () => {
      transactionsService.getTransactions.mockResolvedValue(allTransactionPage);
      transactionGroupsService.getTransactionGroup.mockImplementation(getTransactionGroupMock);

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
      transactionsService.getTransactions.mockResolvedValue(allTransactionPage);
      transactionGroupsService.getTransactionGroup.mockImplementation(getTransactionGroupMock);

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
      transactionsService.getHistoryTransactions.mockResolvedValue(allTransactionPage);
      transactionGroupsService.getTransactionGroup.mockImplementation(getTransactionGroupMock);

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
      transactionsService.getHistoryTransactions.mockResolvedValue(allTransactionPage);
      transactionGroupsService.getTransactionGroup.mockImplementation(getTransactionGroupMock);

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
      transactionsService.getHistoryTransactions.mockResolvedValue(allTransactionPage);
      transactionGroupsService.getTransactionGroup.mockImplementation(getTransactionGroupMock);

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

  describe('error report', () => {
    it('minValidStart() should throw error when receiving empty array', () => {
      expect(() => minValidStart([])).toThrow(Error);
    });

    it('maxUpdatedAt() should throw error when receiving empty array', () => {
      expect(() => maxUpdatedAt([])).toThrow(Error);
    });

    it('maxExecutedAt() should throw error when receiving empty array', () => {
      expect(() => maxExecutedAt([])).toThrow(Error);
    });

    it('maxExecutedAt() should return max execution date', () => {
      const transactions: Transaction[] = [childTransaction1, childTransaction2];
      expect(maxExecutedAt(transactions)).toBe(childTransaction2.executedAt);
    });
  });
});
