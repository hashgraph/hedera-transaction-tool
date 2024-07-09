import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { mock, mockDeep } from 'jest-mock-extended';
import { DataSource, Repository } from 'typeorm';

import { MirrorNodeService, NOTIFICATIONS_SERVICE } from '@app/common';
import { TransactionApprover, User } from '@entities';

import { ApproversService } from './approvers.service';
import { getRepositoryToken } from '@nestjs/typeorm';

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
});
