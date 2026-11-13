import type { IGroupSnapshotMember } from './organization';

// The locally-held reviewer state of one organization (see prisma ReviewerGroup,
// ReviewerGroupMember, ReviewerRule): a plain mirror of whatever the organization server
// currently reports, trusted as-is — see shared/utils/reviewerSync.ts.
export interface IStoredReviewerGroup {
  id: number;
  name: string;
  description: string | null;
  threshold: number;
  members: IGroupSnapshotMember[];
}

export interface IStoredReviewerRule {
  id: number;
  groupId: number;
  hederaId: string;
  network: string;
  entityRole: string | null;
  transactionType: string | null;
}

export interface IReviewerStoreState {
  groups: IStoredReviewerGroup[];
  rules: IStoredReviewerRule[];
}

// Everything one sync wants to change, applied by the main process in a single transaction.
export interface IReviewerStoreChanges {
  upsertGroups: IStoredReviewerGroup[];
  deleteGroupIds: number[];
  upsertRules: IStoredReviewerRule[];
  deleteRuleIds: number[];
}

// A group whose current detail could not be fetched this sync; it's left exactly as it was
// locally, and the rest of the sync still applies. groupId is null for a failure that isn't
// specific to one group (e.g. the group or rule list itself couldn't be fetched).
export interface IReviewerSyncFailure {
  groupId: number | null;
}

export interface IReviewerSyncPlan extends IReviewerStoreChanges {
  failures: IReviewerSyncFailure[];
}
