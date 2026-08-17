import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { guardMock } from '@app/common';
import { User, UserStatus } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard, AdminGuard } from '../guards';

import { CreateReviewerRuleDto, DeleteReviewerRuleDto } from './dtos';
import { ReviewerRulesController } from './reviewer-rules.controller';
import { ReviewerRulesService } from './reviewer-rules.service';

describe('ReviewerRulesController', () => {
  let controller: ReviewerRulesController;

  const service = mockDeep<ReviewerRulesService>();

  const user: User = {
    id: 1,
    email: 'admin@test.com',
    password: 'hash',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewerRulesController],
      providers: [{ provide: ReviewerRulesService, useValue: service }],
    })
      .overrideGuard(JwtBlackListAuthGuard).useValue(guardMock())
      .overrideGuard(JwtAuthGuard).useValue(guardMock())
      .overrideGuard(VerifiedUserGuard).useValue(guardMock())
      .overrideGuard(AdminGuard).useValue(guardMock())
      .compile();

    controller = module.get(ReviewerRulesController);
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRules', () => {
    it('delegates to service.getRules and returns result', async () => {
      const result = [] as any;
      service.getRules.mockResolvedValueOnce(result);

      expect(await controller.getRules()).toBe(result);
      expect(service.getRules).toHaveBeenCalled();
    });
  });

  describe('getRuleChanges', () => {
    it('delegates to service.getRuleChanges and returns result', async () => {
      const result = [] as any;
      service.getRuleChanges.mockResolvedValueOnce(result);

      expect(await controller.getRuleChanges(1)).toBe(result);
      expect(service.getRuleChanges).toHaveBeenCalledWith(1);
    });
  });

  describe('getRule', () => {
    it('delegates to service.getRule and returns result', async () => {
      const result = {} as any;
      service.getRule.mockResolvedValueOnce(result);

      expect(await controller.getRule(1)).toBe(result);
      expect(service.getRule).toHaveBeenCalledWith(1);
    });
  });

  describe('createRule', () => {
    it('delegates to service.createRule with dto and user id', async () => {
      const dto = {} as CreateReviewerRuleDto;
      const result = {} as any;
      service.createRule.mockResolvedValueOnce(result);

      expect(await controller.createRule(dto, user)).toBe(result);
      expect(service.createRule).toHaveBeenCalledWith(dto, user.id);
    });
  });

  describe('deleteRule', () => {
    it('delegates to service.deleteRule with id, dto, and user id', async () => {
      const dto = {} as DeleteReviewerRuleDto;
      const result = {} as any;
      service.deleteRule.mockResolvedValueOnce(result);

      expect(await controller.deleteRule(1, dto, user)).toBe(result);
      expect(service.deleteRule).toHaveBeenCalledWith(1, dto, user.id);
    });
  });
});
