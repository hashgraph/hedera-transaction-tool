import { mockDeep } from 'jest-mock-extended';
import { EntityManager } from 'typeorm';

import {
  EntityRole,
  ReviewerGroup,
  ReviewerRule,
  TransactionEntity,
  TransactionReviewerList,
  TransactionType,
} from '@entities';

import { ReviewerAssignmentService } from './reviewer-assignment.service';

const NETWORK = 'testnet';

function makeRule(overrides: Partial<ReviewerRule> = {}): ReviewerRule {
  return {
    id: 1,
    groupId: 10,
    hederaEntityId: '0.0.1',
    network: NETWORK,
    entityRole: null,
    transactionType: null,
    createdAt: new Date(),
    deletedAt: null as any,
    changeRecords: [],
    group: null as any,
    ...overrides,
  };
}

function makeEntity(overrides: Partial<TransactionEntity> = {}): TransactionEntity {
  return {
    id: 1,
    transactionId: 1,
    hederaEntityId: '0.0.1',
    network: NETWORK,
    entityRole: EntityRole.FEE_PAYER,
    createdAt: new Date(),
    transaction: null as any,
    ...overrides,
  };
}

describe('ReviewerAssignmentService', () => {
  let service: ReviewerAssignmentService;
  let em: ReturnType<typeof mockDeep<EntityManager>>;

  beforeEach(() => {
    service = new ReviewerAssignmentService();
    em = mockDeep<EntityManager>();
    em.create.mockImplementation((_entity: any, data: any) => ({ ...data }));
    em.save.mockImplementation(async (_entity: any, data: any) => {
      if (Array.isArray(data)) {
        data.forEach((d: any, i: number) => { if (!d.id) d.id = i + 1; });
        return data;
      }
      if (!data.id) data.id = 1;
      return data;
    });
    em.find.mockResolvedValue([]);
    em.findOne.mockResolvedValue(null);
  });

  describe('assign', () => {
    it('returns false and skips snapshots when no rules match', async () => {
      em.find.mockResolvedValueOnce([makeEntity()]); // entities
      em.find.mockResolvedValueOnce([]);             // no rules

      const result = await service.assign(1, TransactionType.ACCOUNT_CREATE, NETWORK, em);

      expect(result).toBe(false);
      expect(em.findOne).not.toHaveBeenCalled();
    });

    it('returns false when rules exist but none match the transaction', async () => {
      em.find.mockResolvedValueOnce([makeEntity()]); // entity is 0.0.1; rule targets 0.0.999
      em.find.mockResolvedValueOnce([makeRule({ hederaEntityId: '0.0.999' })]);

      const result = await service.assign(1, TransactionType.ACCOUNT_CREATE, NETWORK, em);

      expect(result).toBe(false);
    });

    it('matches a rule with no filters beyond hederaEntityId', async () => {
      em.find.mockResolvedValueOnce([makeEntity()]);
      em.find.mockResolvedValueOnce([makeRule({ hederaEntityId: '0.0.1', entityRole: null, transactionType: null })]);

      const group: Partial<ReviewerGroup> = {
        id: 10, name: 'Approvers', description: null, threshold: 1,
        members: [{ userId: 2, userKeyId: 5, groupId: 10 } as any],
      };
      em.findOne.mockResolvedValueOnce(group);

      const result = await service.assign(1, TransactionType.ACCOUNT_CREATE, NETWORK, em);

      expect(result).toBe(true);
      expect(em.save).toHaveBeenCalledWith(
        TransactionReviewerList,
        expect.objectContaining({ transactionId: 1, name: 'Approvers', threshold: 1 }),
      );
    });

    it('filters by entity_role when set', async () => {
      // entity is FEE_PAYER; rule requires SENDER
      em.find.mockResolvedValueOnce([makeEntity({ entityRole: EntityRole.FEE_PAYER })]);
      em.find.mockResolvedValueOnce([makeRule({ hederaEntityId: '0.0.1', entityRole: EntityRole.SENDER })]);

      const result = await service.assign(1, TransactionType.ACCOUNT_CREATE, NETWORK, em);

      expect(result).toBe(false);
    });

    it('deduplicates groups matched by multiple rules', async () => {
      em.find.mockResolvedValueOnce([makeEntity()]);
      em.find.mockResolvedValueOnce([
        makeRule({ id: 1, groupId: 10, hederaEntityId: '0.0.1' }),
        makeRule({ id: 2, groupId: 10, hederaEntityId: '0.0.1', entityRole: EntityRole.FEE_PAYER }),
      ]);

      const group: Partial<ReviewerGroup> = {
        id: 10, name: 'G', description: null, threshold: 1,
        members: [{ userId: 7, userKeyId: 1, groupId: 10 } as any],
      };
      em.findOne.mockResolvedValueOnce(group);

      const result = await service.assign(1, TransactionType.ACCOUNT_CREATE, NETWORK, em);

      expect(result).toBe(true);
      expect(em.findOne).toHaveBeenCalledTimes(1);
    });

    it('snapshots all group members including the transaction creator', async () => {
      em.find.mockResolvedValueOnce([makeEntity()]);
      em.find.mockResolvedValueOnce([makeRule()]);

      const group: Partial<ReviewerGroup> = {
        id: 10, name: 'G', description: null, threshold: 2,
        members: [
          { userId: 42, userKeyId: 1, groupId: 10 } as any,
          { userId: 99, userKeyId: 2, groupId: 10 } as any,
        ],
      };
      em.findOne.mockResolvedValueOnce(group);

      await service.assign(1, TransactionType.ACCOUNT_CREATE, NETWORK, em);

      const savedMembers = (em.save as jest.Mock).mock.calls.find(
        ([, data]) => Array.isArray(data),
      )?.[1] as any[];
      expect(savedMembers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: 42 }),
          expect.objectContaining({ userId: 99 }),
        ]),
      );
    });

    it('gracefully skips a group with no members', async () => {
      em.find.mockResolvedValueOnce([makeEntity()]);
      em.find.mockResolvedValueOnce([makeRule()]);
      em.findOne.mockResolvedValueOnce({ id: 10, name: 'G', description: null, threshold: 1, members: [] });

      const result = await service.assign(1, TransactionType.ACCOUNT_CREATE, NETWORK, em);

      expect(result).toBe(false);
      expect(em.save).not.toHaveBeenCalledWith(TransactionReviewerList, expect.anything());
    });

    it('gracefully skips a group when it no longer exists', async () => {
      em.find.mockResolvedValueOnce([makeEntity()]);
      em.find.mockResolvedValueOnce([makeRule()]);
      em.findOne.mockResolvedValueOnce(null); // group deleted

      const result = await service.assign(1, TransactionType.ACCOUNT_CREATE, NETWORK, em);

      expect(result).toBe(false);
    });
  });
});
