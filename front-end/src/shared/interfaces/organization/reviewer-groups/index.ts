// Mirrors back-end/apps/api/src/reviewer-groups/dtos/*.ts and
// back-end/libs/common/src/database/entities/entity-role.enum.ts.
export const ENTITY_ROLES = [
  'account',
  'fee_payer',
  'file',
  'node',
  'receiver',
  'sender',
  'token',
  'topic',
] as const;
export type EntityRole = (typeof ENTITY_ROLES)[number];

export const ROLE_LABELS: Record<EntityRole, string> = {
  account: 'account',
  fee_payer: 'fee payer',
  file: 'file',
  node: 'node',
  receiver: 'receiver',
  sender: 'sender',
  token: 'token',
  topic: 'topic',
};

export interface IReviewerGroupSummary {
  id: number;
  name: string;
  description: string | null;
  threshold: number;
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
  // A Hedera entity ID (e.g. "0.0.1234") for most entityRoles, or a plain node ID
  // (e.g. "1") when entityRole is 'node'.
  hederaId: string;
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
  // A Hedera entity ID (e.g. "0.0.1234") for most entityRoles, or a plain node ID
  // (e.g. "1") when entityRole is 'node'.
  hederaId: string;
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

export type IUpdateReviewerGroupRequest = ICreateReviewerGroupRequest;

export type IDeleteReviewerRuleRequest = IDeleteReviewerGroupRequest;

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
