import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mock, mockDeep } from 'jest-mock-extended';
import { DataSource, Repository } from 'typeorm';

import { MirrorNodeService, NOTIFICATIONS_SERVICE, NOTIFY_CLIENT } from '@app/common';
import { TransactionApprover, TransactionStatus, User } from '@entities';
import { userKeysRequiredToSign } from '../../utils';

import { ApproversService } from './approvers.service';
import { CreateTransactionApproversArrayDto } from '../dto';

jest.mock('../../utils');

describe('ApproversService', () => {
  let service: ApproversService;

  const approversRepo = mockDeep<Repository<TransactionApprover>>();
  const dataSource = mockDeep<DataSource>();
  const mirrorNodeService = mock<MirrorNodeService>();
  const notificationsService = mock<ClientProxy>();

  const user = {
    id: 1,
    keys: [
      { id: 3, publicKey: '61f37fc1bbf3ff4453712ee6a305c5c7255955f7889ec3bf30426f1863158ef4' },
    ],
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApproversService,
        {
          provide: getRepositoryToken(TransactionApprover),
          useValue: approversRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: MirrorNodeService,
          useValue: mirrorNodeService,
        },
        {
          provide: NOTIFICATIONS_SERVICE,
          useValue: notificationsService,
        },
      ],
    }).compile();

    service = module.get<ApproversService>(ApproversService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTransactionApproverById', () => {
    it('should return approver by id with repo', async () => {
      const id = 1;
      const approver = new TransactionApprover();
      approver.id = id;
      approversRepo.findOne.mockResolvedValue(approver);

      const result = await service.getTransactionApproverById(id);

      expect(result).toEqual(approver);
    });

    it('should retun approver by id with entity manager', async () => {
      const id = 1;
      const approver = new TransactionApprover();
      approver.id = id;
      dataSource.manager.findOne.mockResolvedValue(approver);

      const result = await service.getTransactionApproverById(id, dataSource.manager);

      expect(result).toEqual(approver);
    });
  });

  describe('getApproversByTransactionId', () => {
    it('should query for approvers for user id with repo', async () => {
      const transactionId = 1;
      const approvers = [new TransactionApprover()];
      approversRepo.query.mockResolvedValue(approvers);

      const result = await service.getApproversByTransactionId(transactionId, user.id);

      expect(approversRepo.query).toHaveBeenCalledWith(expect.anything(), [transactionId, user.id]);
      expect(result).toEqual(approvers);
    });

    it('should query for approvers for user id with entity manager', async () => {
      const transactionId = 1;
      const approvers = [new TransactionApprover()];
      dataSource.manager.query.mockResolvedValue(approvers);

      const result = await service.getApproversByTransactionId(
        transactionId,
        user.id,
        dataSource.manager,
      );

      expect(dataSource.manager.query).toHaveBeenCalledWith(expect.anything(), [
        transactionId,
        user.id,
      ]);
      expect(result).toEqual(approvers);
    });

    it('should query for approvers with entity manager', async () => {
      const transactionId = 1;
      const approvers = [new TransactionApprover()];
      dataSource.manager.query.mockResolvedValue(approvers);

      const result = await service.getApproversByTransactionId(
        transactionId,
        undefined,
        dataSource.manager,
      );

      expect(dataSource.manager.query).toHaveBeenCalledWith(expect.anything(), [transactionId]);
      expect(result).toEqual(approvers);
    });

    it('should query for approvers with repo', async () => {
      const transactionId = 1;
      const approvers = [new TransactionApprover()];
      approversRepo.query.mockResolvedValue(approvers);

      const result = await service.getApproversByTransactionId(transactionId);

      expect(approversRepo.query).toHaveBeenCalledWith(expect.anything(), [transactionId]);
      expect(result).toEqual(approvers);
    });
  });

  describe('getVerifiedApproversByTransactionId', () => {
    it('should get transaction appovers by transaction id if user is creator', async () => {
      const transactionId = 1;
      const transaction = { creatorKey: { user } };
      dataSource.manager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).resolves.not.toThrow();
    });

    it('should get appovers if user is observer', async () => {
      const transactionId = 1;
      const observers = [{ userId: user.id }];
      const transaction = { id: transactionId, observers, signers: [] };
      dataSource.manager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValue([]);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).resolves.not.toThrow();
    });

    it('should get appovers if user is signer', async () => {
      const transactionId = 1;
      const signers = [{ userKey: { user } }];
      const transaction = { id: transactionId, observers: [], signers };
      dataSource.manager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValue([]);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).resolves.not.toThrow();
    });

    it('should get appovers if user is approver', async () => {
      const transactionId = 1;
      const transaction = { id: transactionId, observers: [], signers: [] };
      dataSource.manager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);

      const approvers = [{ userId: user.id }] as TransactionApprover[];
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValue(approvers);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).resolves.not.toThrow();
    });

    it('should get transaction appovers when transaction is visible for everyone', async () => {
      const transactionId = 1;
      const observers = [{ userId: 2 }, { userId: 3 }];
      const transaction = { creatorKey: { user }, status: TransactionStatus.EXECUTED, observers };
      dataSource.manager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).resolves.not.toThrow();
    });

    it('should throw not found exception', async () => {
      const transactionId = 1;
      dataSource.manager.findOne.mockResolvedValue(null);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).rejects.toThrow("Transaction doesn't exist");
    });

    it('should throw if user has not access to this transaction', async () => {
      const transactionId = 1;
      const transaction = { id: transactionId, observers: [], signers: [] };
      dataSource.manager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValue([]);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).rejects.toThrow("You don't have permission to view this transaction");
    });
  });

  describe('getTransactionApproversById', () => {
    it('should return approvers by id with repo', async () => {
      const id = 1;
      const approvers = [new TransactionApprover()];
      approversRepo.query.mockResolvedValue(approvers);

      const result = await service.getTransactionApproversById(id);

      expect(approversRepo.query).toHaveBeenCalledWith(expect.anything(), [id]);
      expect(result).toEqual(approvers);
    });

    it('should return approvers by id with entity manager', async () => {
      const id = 1;
      const approvers = [new TransactionApprover()];
      dataSource.manager.query.mockResolvedValue(approvers);

      const result = await service.getTransactionApproversById(id, dataSource.manager);

      expect(dataSource.manager.query).toHaveBeenCalledWith(expect.anything(), [id]);
      expect(result).toEqual(approvers);
    });
  });

  describe('getRootNodeFromNode', () => {
    it('should send query with the node id', async () => {
      const nodeId = 1;

      await service.getRootNodeFromNode(nodeId);

      expect(dataSource.manager.query).toHaveBeenCalledWith(expect.anything(), [nodeId]);
    });
  });

  describe('removeNode', () => {
    it('should remove node by id', async () => {
      const nodeId = 1;

      await service.removeNode(nodeId);

      expect(dataSource.manager.query).toHaveBeenCalledWith(expect.anything(), [nodeId]);
      expect(notificationsService.emit).toHaveBeenCalledWith(NOTIFY_CLIENT, expect.anything());
    });
  });

  describe('createTransactionApprovers', () => {
    const transaction = {
      id: 1,
      creatorKey: { user },
    };

    beforeEach(() => {
      jest.resetAllMocks();

      dataSource.manager.findOne.mockResolvedValueOnce(transaction);
    });

    it('should create basic transaction approver', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            userId: 1,
          },
        ],
      };

      const transactionMock = jest.fn(async passedFunction => {
        await passedFunction(dataSource.manager);
      });
      dataSource.transaction.mockImplementation(transactionMock);

      await service.createTransactionApprovers(user, transactionId, dto);
    });
  });
});
