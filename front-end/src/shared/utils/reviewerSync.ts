// Plans a reviewer store sync: mirrors the organization server's current reviewer group/rule
// state into the local store. The server is trusted outright — a group change only ever
// reaches APPLIED after the back-end collects a real member attestation threshold for it, and
// the client does not re-verify that itself. A group or rule the server no longer lists is
// simply removed locally.

import type {
  IReviewerGroupDetail,
  IReviewerGroupSummary,
  IReviewerRule,
  IReviewerStoreState,
  IReviewerSyncFailure,
  IReviewerSyncPlan,
  IStoredReviewerGroup,
  IStoredReviewerRule,
} from '../interfaces';

export interface IReviewerSyncSource {
  listGroups(): Promise<Pick<IReviewerGroupSummary, 'id'>[]>;
  getGroup(groupId: number): Promise<IReviewerGroupDetail>;
  listRules(): Promise<IReviewerRule[]>;
}

const toStoredGroup = (group: IReviewerGroupDetail): IStoredReviewerGroup => ({
  id: group.id,
  name: group.name,
  description: group.description,
  threshold: group.threshold,
  members: group.members.map(m => ({
    userId: m.userId,
    userKeyId: m.userKeyId,
    publicKey: m.publicKey,
  })),
});

const toStoredRule = (rule: IReviewerRule): IStoredReviewerRule => ({
  id: rule.id,
  groupId: rule.groupId,
  hederaId: rule.hederaId,
  network: rule.network,
  entityRole: rule.entityRole,
  transactionType: rule.transactionType,
});

export async function planReviewerSync(
  local: IReviewerStoreState,
  source: IReviewerSyncSource,
): Promise<IReviewerSyncPlan> {
  const [serverGroups, serverRules] = await Promise.all([source.listGroups(), source.listRules()]);

  const plan: IReviewerSyncPlan = {
    upsertGroups: [],
    deleteGroupIds: [],
    upsertRules: [],
    deleteRuleIds: [],
    failures: [],
  };

  const serverGroupIds = new Set(serverGroups.map(g => g.id));
  for (const group of local.groups) {
    if (!serverGroupIds.has(group.id)) plan.deleteGroupIds.push(group.id);
  }

  for (const { id } of serverGroups) {
    try {
      plan.upsertGroups.push(toStoredGroup(await source.getGroup(id)));
    } catch {
      const failure: IReviewerSyncFailure = { groupId: id };
      plan.failures.push(failure);
    }
  }

  plan.upsertRules = serverRules.map(toStoredRule);
  const serverRuleIds = new Set(serverRules.map(r => r.id));
  for (const rule of local.rules) {
    if (!serverRuleIds.has(rule.id)) plan.deleteRuleIds.push(rule.id);
  }

  return plan;
}
