import type {
  IReviewerStoreChanges,
  IReviewerStoreState,
  IStoredReviewerRule,
} from '@shared/interfaces';

import { getPrismaClient } from '@main/db/prisma';

// The locally-held reviewer state for one organization — a mirror of whatever the
// organization server currently reports (see #3194).
export const getReviewerState = async (organizationId: string): Promise<IReviewerStoreState> => {
  const prisma = getPrismaClient();
  const [groups, rules] = await Promise.all([
    prisma.reviewerGroup.findMany({ where: { organizationId }, include: { members: true } }),
    prisma.reviewerRule.findMany({ where: { organizationId } }),
  ]);

  return {
    groups: groups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      threshold: g.threshold,
      members: g.members.map(m => ({
        userId: m.userId,
        userKeyId: m.userKeyId,
        publicKey: m.publicKey,
      })),
    })),
    rules: rules.map<IStoredReviewerRule>(r => ({
      id: r.id,
      groupId: r.groupId,
      hederaId: r.hederaId,
      network: r.network,
      entityRole: r.entityRole,
      transactionType: r.transactionType,
    })),
  };
};

// Applies one sync in a single transaction, so a failure part-way leaves the previous local
// state intact. Deletes are explicit rather than relying on cascades.
export const applyReviewerChanges = async (
  organizationId: string,
  changes: IReviewerStoreChanges,
): Promise<void> => {
  const { upsertGroups, deleteGroupIds, upsertRules, deleteRuleIds } = changes;
  const upsertedIds = new Set(upsertGroups.map(g => g.id));
  if (deleteGroupIds.some(id => upsertedIds.has(id))) {
    throw new Error('A group cannot be both deleted and upserted in one sync');
  }

  const prisma = getPrismaClient();
  await prisma.$transaction(async tx => {
    if (deleteGroupIds.length > 0) {
      const groupWhere = { organizationId, groupId: { in: deleteGroupIds } };
      await tx.reviewerRule.deleteMany({ where: groupWhere });
      await tx.reviewerGroupMember.deleteMany({ where: groupWhere });
      await tx.reviewerGroup.deleteMany({ where: { organizationId, id: { in: deleteGroupIds } } });
    }

    if (deleteRuleIds.length > 0) {
      await tx.reviewerRule.deleteMany({ where: { organizationId, id: { in: deleteRuleIds } } });
    }

    for (const { members, ...group } of upsertGroups) {
      await tx.reviewerGroup.upsert({
        where: { organizationId_id: { organizationId, id: group.id } },
        create: { organizationId, ...group },
        update: group,
      });
      await tx.reviewerGroupMember.deleteMany({ where: { organizationId, groupId: group.id } });
      await tx.reviewerGroupMember.createMany({
        data: members.map(m => ({ organizationId, groupId: group.id, ...m })),
      });
    }

    // condition is not exposed by the back-end yet, so upserts leave it untouched.
    for (const rule of upsertRules) {
      await tx.reviewerRule.upsert({
        where: { organizationId_id: { organizationId, id: rule.id } },
        create: { organizationId, ...rule },
        update: rule,
      });
    }
  });
};
