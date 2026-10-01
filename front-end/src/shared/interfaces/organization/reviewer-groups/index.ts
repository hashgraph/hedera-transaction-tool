// Mirrors back-end/apps/api/src/reviewer-groups/dtos/*.ts and
// back-end/libs/common/src/database/entities/entity-role.enum.ts.
export const ENTITY_ROLES = [
  'fee_payer',
  'sender',
  'receiver',
  'account',
  'file',
  'token',
  'topic',
  'node',
] as const;
export type EntityRole = (typeof ENTITY_ROLES)[number];

export interface IReviewerGroupSummary {
  id: number;
  name: string;
  description: string | null;
  threshold: number;
  memberCount: number;
  ruleCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface IReviewerGroupMember {
  id: number;
  groupId: number;
  userId: number;
  userKeyId: number;
  createdAt: string | Date;
}

export interface IReviewerRule {
  id: number;
  groupId: number;
  hederaEntityId: string;
  network: string;
  entityRole: EntityRole | null;
  transactionType: string | null;
  createdAt: string | Date;
}

export interface IReviewerGroupDetail extends IReviewerGroupSummary {
  members: IReviewerGroupMember[];
  rules: IReviewerRule[];
}

export interface IGroupMemberInput {
  userId: number;
  userKeyId: number;
}

export interface ICreateReviewerGroupRequest {
  name: string;
  description?: string;
  threshold: number;
  members: IGroupMemberInput[];
  userKeyId: number;
  userSignature: string;
}

export interface ICreateReviewerRuleRequest {
  groupId: number;
  hederaEntityId: string;
  network: string;
  entityRole?: EntityRole;
  transactionType?: string;
  userKeyId: number;
  userSignature: string;
}

export interface IDeleteReviewerGroupRequest {
  userKeyId: number;
  userSignature: string;
}

export type ChangeRequestStatus = 'PENDING' | 'APPLIED' | 'REJECTED';

export interface IAttestationSignature {
  userKeyId: number;
  vote: 'approve' | 'reject';
  signature: string;
}

export interface IGroupChangeRecord {
  id: number;
  groupId: number;
  type: 'UPDATE' | 'DELETE';
  status: ChangeRequestStatus;
  snapshotVersion: number;
  attestationSignatures: IAttestationSignature[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface IRuleChangeRecord {
  id: number;
  ruleId: number | null;
  groupId: number | null;
  action: 'add' | 'remove';
  status: ChangeRequestStatus;
  groupSnapshotVersion: number | null;
  attestationSignatures: IAttestationSignature[] | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}
