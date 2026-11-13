import { describe, expect, test, vi, beforeEach } from 'vitest';

import { applyReviewerChanges, getReviewerState } from '@main/services/localUser/reviewerStore';
import { getPrismaClient } from '@main/db/prisma';

vi.mock('@main/db/prisma', () => ({ getPrismaClient: vi.fn() }));

const ORG = 'org-1';

describe('reviewerStore service', () => {
  let tx: any;
  let prisma: any;

  beforeEach(() => {
    vi.resetAllMocks();
    tx = {
      reviewerGroup: { upsert: vi.fn(), deleteMany: vi.fn() },
      reviewerGroupMember: { deleteMany: vi.fn(), createMany: vi.fn() },
      reviewerRule: { upsert: vi.fn(), deleteMany: vi.fn() },
    };
    prisma = {
      reviewerGroup: { findMany: vi.fn() },
      reviewerRule: { findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (t: any) => Promise<void>) => fn(tx)),
    };
    vi.mocked(getPrismaClient).mockReturnValue(prisma);
  });

  describe('getReviewerState', () => {
    test('returns only the given organization, shaped for the sync planner', async () => {
      prisma.reviewerGroup.findMany.mockResolvedValue([
        {
          organizationId: ORG,
          id: 1,
          name: 'G',
          description: null,
          threshold: 1,
          members: [{ organizationId: ORG, groupId: 1, userId: 2, userKeyId: 3, publicKey: 'pk' }],
        },
      ]);
      prisma.reviewerRule.findMany.mockResolvedValue([
        {
          organizationId: ORG,
          id: 5,
          groupId: 1,
          hederaId: '0.0.1',
          network: 'testnet',
          entityRole: null,
          transactionType: null,
          condition: null,
        },
      ]);

      const state = await getReviewerState(ORG);

      expect(prisma.reviewerGroup.findMany).toHaveBeenCalledWith({
        where: { organizationId: ORG },
        include: { members: true },
      });
      expect(prisma.reviewerRule.findMany).toHaveBeenCalledWith({ where: { organizationId: ORG } });
      expect(state).toEqual({
        groups: [
          {
            id: 1,
            name: 'G',
            description: null,
            threshold: 1,
            members: [{ userId: 2, userKeyId: 3, publicKey: 'pk' }],
          },
        ],
        rules: [
          {
            id: 5,
            groupId: 1,
            hederaId: '0.0.1',
            network: 'testnet',
            entityRole: null,
            transactionType: null,
          },
        ],
      });
    });
  });

  describe('applyReviewerChanges', () => {
    const group = {
      id: 1,
      name: 'G',
      description: null,
      threshold: 1,
      members: [
        { userId: 2, userKeyId: 3, publicKey: 'pk' },
        { userId: 4, userKeyId: 5, publicKey: 'pk2' },
      ],
    };
    const rule = {
      id: 9,
      groupId: 1,
      hederaId: '0.0.1',
      network: 'testnet',
      entityRole: null,
      transactionType: null,
    };

    test('writes everything inside one transaction, scoped to the organization', async () => {
      await applyReviewerChanges(ORG, {
        upsertGroups: [group],
        deleteGroupIds: [7],
        upsertRules: [rule],
        deleteRuleIds: [8],
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Deleting a group removes its rules and members explicitly, then the group.
      expect(tx.reviewerRule.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: ORG, groupId: { in: [7] } },
      });
      expect(tx.reviewerGroupMember.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: ORG, groupId: { in: [7] } },
      });
      expect(tx.reviewerGroup.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: ORG, id: { in: [7] } },
      });
      expect(tx.reviewerRule.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: ORG, id: { in: [8] } },
      });

      const { members, ...fields } = group;
      expect(tx.reviewerGroup.upsert).toHaveBeenCalledWith({
        where: { organizationId_id: { organizationId: ORG, id: 1 } },
        create: { organizationId: ORG, ...fields },
        update: fields,
      });
      // Members are replaced wholesale.
      expect(tx.reviewerGroupMember.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: ORG, groupId: 1 },
      });
      expect(tx.reviewerGroupMember.createMany).toHaveBeenCalledWith({
        data: members.map(m => ({ organizationId: ORG, groupId: 1, ...m })),
      });
      expect(tx.reviewerRule.upsert).toHaveBeenCalledWith({
        where: { organizationId_id: { organizationId: ORG, id: 9 } },
        create: { organizationId: ORG, ...rule },
        update: rule,
      });
    });

    test('skips delete queries when there is nothing to delete', async () => {
      await applyReviewerChanges(ORG, {
        upsertGroups: [],
        deleteGroupIds: [],
        upsertRules: [],
        deleteRuleIds: [],
      });
      expect(tx.reviewerRule.deleteMany).not.toHaveBeenCalled();
      expect(tx.reviewerGroup.deleteMany).not.toHaveBeenCalled();
    });

    test('rejects a group that is both deleted and upserted, before touching the database', async () => {
      await expect(
        applyReviewerChanges(ORG, {
          upsertGroups: [group],
          deleteGroupIds: [1],
          upsertRules: [],
          deleteRuleIds: [],
        }),
      ).rejects.toThrow('both deleted and upserted');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test('propagates a failure from inside the transaction', async () => {
      tx.reviewerRule.upsert.mockRejectedValue(new Error('boom'));
      await expect(
        applyReviewerChanges(ORG, {
          upsertGroups: [],
          deleteGroupIds: [],
          upsertRules: [rule],
          deleteRuleIds: [],
        }),
      ).rejects.toThrow('boom');
    });
  });
});
