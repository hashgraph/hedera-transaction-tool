import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';
import { EntityManager } from 'typeorm';

import { BlacklistService, guardMock } from '@app/common';
import { TransactionApprover, User, UserStatus } from '@entities';

import { VerifiedUserGuard } from '../../guards';

import { ApproversController } from './approvers.controller';
import { ApproversService } from './approvers.service';

describe('ApproversController', () => {
  let controller: ApproversController;
  let user: User;
  let transactionApprover: TransactionApprover;

  const approversService = mockDeep<ApproversService>();
  const entityManager = mockDeep<EntityManager>();
  const blacklistService = mockDeep<BlacklistService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApproversController],
      providers: [
        {
          provide: ApproversService,
          useValue: approversService,
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
      .overrideGuard(VerifiedUserGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get<ApproversController>(ApproversController);
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
    transactionApprover = {
      id: 1,
      transaction: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      user: user,
      approved: false,
      approvers: [],
    };
  });

  describe('createTransactionApprovers', () => {
    it('should return an approver', async () => {
      const result = [transactionApprover];

      approversService.createTransactionApprovers.mockResolvedValue(result);

      expect(
        await controller.createTransactionApprovers(user, 1, {
          approversArray: [{ userId: user.id }],
        }),
      ).toBe(result);
    });
  });

  describe('approveTransaction', () => {
    it('should return a boolean indicating if the approval was successful', async () => {
      const result = true;
      const approval = {
        userKeyId: 1,
        signature: Buffer.from('asdlfinfeianef203finasdfljn23f9inasdf'),
        approved: true,
      };

      approversService.approveTransaction.mockResolvedValue(result);

      expect(await controller.approveTransaction(user, 1, approval)).toBe(result);
    });
  });

  describe('getTransactionApproversByTransactionId', () => {
    it('should return an array of approvers', async () => {
      const result = [transactionApprover];

      approversService.getVerifiedApproversByTransactionId.mockResolvedValue(result);

      expect(await controller.getTransactionApproversByTransactionId(user, 1)).toBe(result);
    });
  });

  describe('removeTransactionApprover', () => {
    it('should return a boolean indicating if the removal was successful', async () => {
      const result = true;

      expect(await controller.removeTransactionApprover(user, 1, 1)).toBe(result);
      expect(approversService.removeTransactionApprover).toHaveBeenCalled();
    });
  });

  describe('updateTransactionApprover', () => {
    it('should return an approver', async () => {
      const result = transactionApprover;

      approversService.updateTransactionApprover.mockResolvedValue(result);

      expect(await controller.updateTransactionApprover(user, 1, 1, { userId: 2 })).toBe(result);
    });
  });
});
