import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import {
  ChangeRequestStatus,
  GroupChangeRecord,
  GroupChangeType,
  ReviewerAction,
  ReviewerGroup,
  ReviewerRule,
  RuleChangeRecord,
} from '@entities';
import { ErrorCodes } from '@app/common';

import { CreateReviewerRuleDto, DeleteReviewerRuleDto } from './dtos';
import { ReviewerRulesService } from './reviewer-rules.service';

describe('ReviewerRulesService', () => {
  let service: ReviewerRulesService;

  const groupRepo = mockDeep<Repository<ReviewerGroup>>();
  const ruleRepo = mockDeep<Repository<ReviewerRule>>();
  const ruleChangeRecordRepo = mockDeep<Repository<RuleChangeRecord>>();
  const groupChangeRecordRepo = mockDeep<Repository<GroupChangeRecord>>();
  const dataSource = mockDeep<DataSource>();
  const manager = mockDeep<EntityManager>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewerRulesService,
        { provide: getRepositoryToken(ReviewerGroup), useValue: groupRepo },
        { provide: getRepositoryToken(ReviewerRule), useValue: ruleRepo },
        { provide: getRepositoryToken(RuleChangeRecord), useValue: ruleChangeRecordRepo },
        { provide: getRepositoryToken(GroupChangeRecord), useValue: groupChangeRecordRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(ReviewerRulesService);
    jest.resetAllMocks();
    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));
  });

  const mockRule = (overrides: Partial<ReviewerRule> = {}): ReviewerRule =>
    ({
      id: 1,
      groupId: 1,
      hederaEntityId: '0.0.1234',
      network: 'testnet',
      entityRole: null,
      transactionType: null,
      deletedAt: null,
      ...overrides,
    } as unknown as ReviewerRule);

  const mockAppliedGroupRecord = (overrides: Partial<GroupChangeRecord> = {}): GroupChangeRecord =>
    ({
      id: 1,
      groupId: 1,
      type: GroupChangeType.UPDATE,
      status: ChangeRequestStatus.APPLIED,
      snapshotVersion: 3,
      ...overrides,
    } as unknown as GroupChangeRecord);

  const mockRuleChangeRecord = (overrides: Partial<RuleChangeRecord> = {}): RuleChangeRecord =>
    ({
      id: 1,
      ruleId: 1,
      groupId: 1,
      action: ReviewerAction.ADD,
      status: ChangeRequestStatus.APPLIED,
      ...overrides,
    } as unknown as RuleChangeRecord);

  const createDto: CreateReviewerRuleDto = {
    groupId: 1,
    hederaEntityId: '0.0.1234',
    network: 'testnet',
    entityRole: null,
    transactionType: null,
    userKeyId: 99,
    userSignature: null,
  };

  const deleteDto: DeleteReviewerRuleDto = { userKeyId: 99, userSignature: null };

  const mockQb = (returnValue: ReviewerRule | null) => ({
    withDeleted: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(returnValue),
  });

  describe('getRules', () => {
    it('returns all rules', async () => {
      const rules = [mockRule()];
      ruleRepo.find.mockResolvedValueOnce(rules);

      const result = await service.getRules();

      expect(result).toBe(rules);
    });
  });

  describe('getRuleChanges', () => {
    it('throws RRNF if rule not found', async () => {
      ruleRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.getRuleChanges(1)).rejects.toThrow(ErrorCodes.RRNF);
    });

    it('returns change records for the rule', async () => {
      const records = [mockRuleChangeRecord()];
      ruleRepo.findOne.mockResolvedValueOnce(mockRule());
      ruleChangeRecordRepo.find.mockResolvedValueOnce(records);

      const result = await service.getRuleChanges(1);

      expect(result).toBe(records);
      expect(ruleChangeRecordRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ruleId: 1 } }),
      );
    });
  });

  describe('getRule', () => {
    it('throws RRNF if rule not found', async () => {
      ruleRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.getRule(1)).rejects.toThrow(ErrorCodes.RRNF);
    });

    it('returns the rule', async () => {
      const rule = mockRule();
      ruleRepo.findOne.mockResolvedValueOnce(rule);

      const result = await service.getRule(1);

      expect(result).toBe(rule);
    });
  });

  describe('createRule', () => {
    it('throws RGNF if group not found', async () => {
      groupRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.createRule(createDto, 5)).rejects.toThrow(ErrorCodes.RGNF);
    });

    it('throws RGDR on duplicate rule (23505)', async () => {
      groupRepo.findOne.mockResolvedValueOnce({ id: 1 } as ReviewerGroup);
      manager.createQueryBuilder.mockReturnValueOnce(mockQb(null) as any);

      const dbError = new QueryFailedError('', [], new Error());
      (dbError as any).code = '23505';
      manager.save.mockRejectedValueOnce(dbError);

      await expect(service.createRule(createDto, 5)).rejects.toThrow(ErrorCodes.RGDR);
    });

    it('restores a soft-deleted rule and creates an APPLIED ADD record', async () => {
      const softDeletedRule = mockRule({ deletedAt: new Date() });
      const changeRecord = mockRuleChangeRecord();
      groupRepo.findOne.mockResolvedValueOnce({ id: 1 } as ReviewerGroup);
      manager.createQueryBuilder.mockReturnValueOnce(mockQb(softDeletedRule) as any);
      manager.restore.mockResolvedValueOnce({} as any);
      manager.create.mockReturnValueOnce(changeRecord as any);
      manager.save.mockResolvedValueOnce(changeRecord as any);

      const result = await service.createRule(createDto, 5);

      expect(manager.restore).toHaveBeenCalledWith(ReviewerRule, { id: softDeletedRule.id });
      expect(result).toBe(softDeletedRule);
    });

    it('creates a new rule and an APPLIED ADD record when no soft-deleted match', async () => {
      const newRule = mockRule();
      const changeRecord = mockRuleChangeRecord();
      groupRepo.findOne.mockResolvedValueOnce({ id: 1 } as ReviewerGroup);
      manager.createQueryBuilder.mockReturnValueOnce(mockQb(null) as any);
      manager.create
        .mockReturnValueOnce(newRule as any)
        .mockReturnValueOnce(changeRecord as any);
      manager.save
        .mockResolvedValueOnce(newRule as any)
        .mockResolvedValueOnce(changeRecord as any);

      const result = await service.createRule(createDto, 5);

      expect(result).toBe(newRule);
      expect(manager.create).toHaveBeenCalledWith(
        RuleChangeRecord,
        expect.objectContaining({ action: ReviewerAction.ADD, status: ChangeRequestStatus.APPLIED }),
      );
    });

    it('filters by non-null entityRole and transactionType in soft-delete lookup', async () => {
      const dto = { ...createDto, entityRole: 'PAYER' as any, transactionType: 'CRYPTO_TRANSFER' };
      const newRule = mockRule();
      const changeRecord = mockRuleChangeRecord();
      groupRepo.findOne.mockResolvedValueOnce({ id: 1 } as ReviewerGroup);
      manager.createQueryBuilder.mockReturnValueOnce(mockQb(null) as any);
      manager.create
        .mockReturnValueOnce(newRule as any)
        .mockReturnValueOnce(changeRecord as any);
      manager.save
        .mockResolvedValueOnce(newRule as any)
        .mockResolvedValueOnce(changeRecord as any);

      await service.createRule(dto, 5);
    });

    it('rethrows non-database errors', async () => {
      groupRepo.findOne.mockResolvedValueOnce({ id: 1 } as ReviewerGroup);
      manager.createQueryBuilder.mockReturnValueOnce(mockQb(null) as any);
      manager.create.mockReturnValueOnce({} as any);
      manager.save.mockRejectedValueOnce(new Error('unexpected'));

      await expect(service.createRule(createDto, 5)).rejects.toThrow('unexpected');
    });
  });

  describe('deleteRule', () => {
    it('throws RRNF if rule not found', async () => {
      ruleRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.deleteRule(1, deleteDto, 5)).rejects.toThrow(ErrorCodes.RRNF);
    });

    it('throws RGCP if a pending request already exists', async () => {
      ruleRepo.findOne.mockResolvedValueOnce(mockRule());
      ruleChangeRecordRepo.findOne.mockResolvedValueOnce(mockRuleChangeRecord({ status: ChangeRequestStatus.PENDING }));

      await expect(service.deleteRule(1, deleteDto, 5)).rejects.toThrow(ErrorCodes.RGCP);
    });

    it('throws RGNF if no latest applied group record found', async () => {
      ruleRepo.findOne.mockResolvedValueOnce(mockRule());
      ruleChangeRecordRepo.findOne.mockResolvedValueOnce(null);
      groupChangeRecordRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.deleteRule(1, deleteDto, 5)).rejects.toThrow(ErrorCodes.RGNF);
    });

    it('throws RGNF if latest group record type is DELETE (group soft-deleted)', async () => {
      ruleRepo.findOne.mockResolvedValueOnce(mockRule());
      ruleChangeRecordRepo.findOne.mockResolvedValueOnce(null);
      groupChangeRecordRepo.findOne.mockResolvedValueOnce(
        mockAppliedGroupRecord({ type: GroupChangeType.DELETE }),
      );

      await expect(service.deleteRule(1, deleteDto, 5)).rejects.toThrow(ErrorCodes.RGNF);
    });

    it('creates a PENDING REMOVE record', async () => {
      const pendingRecord = mockRuleChangeRecord({ action: ReviewerAction.REMOVE, status: ChangeRequestStatus.PENDING });
      ruleRepo.findOne.mockResolvedValueOnce(mockRule());
      ruleChangeRecordRepo.findOne.mockResolvedValueOnce(null);
      groupChangeRecordRepo.findOne.mockResolvedValueOnce(mockAppliedGroupRecord());
      manager.create.mockReturnValueOnce(pendingRecord as any);
      manager.save.mockResolvedValueOnce(pendingRecord as any);

      const result = await service.deleteRule(1, deleteDto, 5);

      expect(result).toBe(pendingRecord);
      expect(manager.create).toHaveBeenCalledWith(
        RuleChangeRecord,
        expect.objectContaining({
          action: ReviewerAction.REMOVE,
          status: ChangeRequestStatus.PENDING,
          groupSnapshotVersion: 3,
        }),
      );
    });

    it('throws RGCP on concurrent duplicate insert (23505)', async () => {
      ruleRepo.findOne.mockResolvedValueOnce(mockRule());
      ruleChangeRecordRepo.findOne.mockResolvedValueOnce(null);
      groupChangeRecordRepo.findOne.mockResolvedValueOnce(mockAppliedGroupRecord());
      manager.create.mockReturnValueOnce({} as any);

      const dbError = new QueryFailedError('', [], new Error());
      (dbError as any).code = '23505';
      manager.save.mockRejectedValueOnce(dbError);

      await expect(service.deleteRule(1, deleteDto, 5)).rejects.toThrow(ErrorCodes.RGCP);
    });

    it('rethrows non-database errors', async () => {
      ruleRepo.findOne.mockResolvedValueOnce(mockRule());
      ruleChangeRecordRepo.findOne.mockResolvedValueOnce(null);
      groupChangeRecordRepo.findOne.mockResolvedValueOnce(mockAppliedGroupRecord());
      manager.create.mockReturnValueOnce({} as any);
      manager.save.mockRejectedValueOnce(new Error('unexpected'));

      await expect(service.deleteRule(1, deleteDto, 5)).rejects.toThrow('unexpected');
    });
  });
});
