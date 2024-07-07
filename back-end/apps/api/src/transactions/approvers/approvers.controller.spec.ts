import { Test, TestingModule } from '@nestjs/testing';
import { ApproversController } from './approvers.controller';
import { ApproversService } from './approvers.service';
import { TransactionApprover, User, UserStatus } from '@entities';

describe('ApproversController', () => {
  let controller: ApproversController;
  let user: User;
  let transactionApprover: TransactionApprover;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApproversController],
      providers: [
        {
          provide: ApproversService,
          useValue: {
            getTransactionApproverById: jest.fn(),
            getApproversByTransactionId: jest.fn(),
            getVerifiedApproversByTransactionId: jest.fn(),
            getTransactionApproversById: jest.fn(),
            getRootNodeFromNode: jest.fn(),
            removeNode: jest.fn(),
            createTransactionApprovers: jest.fn(),
            updateTransactionApprover: jest.fn(),
            removeTransactionApprover: jest.fn(),
            approveTransaction: jest.fn(),
            getCreatorsTransaction: jest.fn(),
            getTreeStructure: jest.fn(),
          }
        },
      ],
    }).compile();

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
      comments: []
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

      jest.spyOn(controller, 'createTransactionApprovers').mockResolvedValue(result);

      expect(await controller.createTransactionApprovers(user, 1, { approversArray: [{ userId: user.id }] })).toBe(result);
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

      jest.spyOn(controller, 'approveTransaction').mockResolvedValue(result);

      expect(await controller.approveTransaction(user, 1, approval)).toBe(result);
    });
  });

  describe('getTransactionApproversByTransactionId', () => {
    it('should return an array of approvers', async () => {
      const result = [transactionApprover];

      jest.spyOn(controller, 'getTransactionApproversByTransactionId').mockResolvedValue(result);

      expect(await controller.getTransactionApproversByTransactionId(user, 1)).toBe(result);
    });
  });

  describe('removeTransactionApprover', () => {
    it('should return a boolean indicating if the removal was successful', async () => {
      const result = true;

      jest.spyOn(controller, 'removeTransactionApprover').mockResolvedValue(result);

      expect(await controller.removeTransactionApprover(user, 1, 1)).toBe(result);
    });
  });

  describe('updateTransactionApprover', () => {
    it('should return an approver', async () => {
      const result = transactionApprover;

      jest.spyOn(controller, 'updateTransactionApprover').mockResolvedValue(result);

      expect(await controller.updateTransactionApprover(user, 1, 1, { userId: 2 })).toBe(result);
    });
  });
});
