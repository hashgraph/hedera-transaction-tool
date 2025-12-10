import { mockDeep } from 'jest-mock-extended';
import { TransactionNodesService } from './transaction-nodes.service';
import { TransactionNodesController } from './transaction-nodes.controller';
import { ITransactionNode, TransactionNodeCollection } from '../dto/ITransactionNode';
import { TransactionStatus, User, UserStatus } from '@entities';
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { BlacklistService, guardMock } from '@app/common';
import { HasKeyGuard, VerifiedUserGuard } from '../../guards';

describe('TransactionNodesController', () => {
  let controller: TransactionNodesController;
  let user: User;
  let transactionNode: ITransactionNode;

  const transactionNodesService = mockDeep<TransactionNodesService>();
  const entityManager = mockDeep<EntityManager>();
  const blacklistService = mockDeep<BlacklistService>();
  const TEST_NETWORK = 'testnet';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionNodesController],
      providers: [
        {
          provide: TransactionNodesService,
          useValue: transactionNodesService,
        },
        {
          provide: EntityManager,
          useValue: entityManager,
        },
        {
          provide: BlacklistService,
          useValue: blacklistService,
        },
      ],
    })
      .overrideGuard(HasKeyGuard)
      .useValue(guardMock())
      .overrideGuard(VerifiedUserGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get<TransactionNodesController>(TransactionNodesController);
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
    transactionNode = {
      transactionId: 1,
      groupId: undefined,
      description: 'Test transaction node',
      createdAt: new Date().toISOString(),
      validStart: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executedAt: undefined,
      status: TransactionStatus.NEW,
      statusCode: undefined,
      sdkTransactionId: '0.0.123@15648433.112315',
      transactionType: 'TRANSFER TRANSACTION',
      groupItemCount: undefined,
      groupCollectedCount: undefined,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHistoryTransactions', () => {
    it('should return an array of transaction nodes', async () => {
      const result = [transactionNode];

      transactionNodesService.getTransactionNodes.mockResolvedValue(result);

      expect(
        await controller.getTransactionNodes(
          user,
          TransactionNodeCollection.HISTORY,
          TEST_NETWORK,
          [],
          [],
        ),
      ).toBe(result);
    });

    it('should return an empty array if no transactions exist', async () => {
      const result = [];

      transactionNodesService.getTransactionNodes.mockResolvedValue(result);

      expect(
        await controller.getTransactionNodes(
          user,
          TransactionNodeCollection.HISTORY,
          TEST_NETWORK,
          [],
          [],
        ),
      ).toEqual(result);
    });
  });
});
