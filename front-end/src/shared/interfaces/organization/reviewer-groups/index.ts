import { BackEndTransactionType } from '../transactions';

// Subset of back-end/libs/common/src/database/entities/entity-role.enum.ts that
// back-end/apps/api/src/transactions/transactions.service.ts's extractTransactionEntities()
// actually assigns today. The back-end enum also reserves 'token'/'topic' for future Token/
// Consensus Service support, but nothing produces them yet — a rule scoped to either could
// never match a real transaction, so they're left out here until that support lands.
export const ENTITY_ROLES = ['account', 'fee_payer', 'file', 'node', 'receiver', 'sender'] as const;
export type EntityRole = (typeof ENTITY_ROLES)[number];

export const ROLE_LABELS: Record<EntityRole, string> = {
  account: 'account',
  fee_payer: 'fee payer',
  file: 'file',
  node: 'node',
  receiver: 'receiver',
  sender: 'sender',
};

// Restricts a reviewer rule's Transaction Type to the BackEndTransactionType values that can
// actually produce the rule's EntityRole, so a saved rule can always match a real transaction
// entity. Mirrors extractTransactionEntities in transactions.service.ts. 'fee_payer' has no
// entry since the fee payer is extracted for every transaction type — no narrowing applies.
export const ROLE_TRANSACTION_TYPES: Partial<Record<EntityRole, Set<BackEndTransactionType>>> = {
  sender: new Set([BackEndTransactionType.TRANSFER]),
  receiver: new Set([BackEndTransactionType.TRANSFER]),
  account: new Set([
    BackEndTransactionType.ACCOUNT_UPDATE,
    BackEndTransactionType.ACCOUNT_DELETE,
    BackEndTransactionType.NODE_CREATE,
    BackEndTransactionType.NODE_UPDATE,
  ]),
  file: new Set([
    BackEndTransactionType.FILE_APPEND,
    BackEndTransactionType.FILE_UPDATE,
    BackEndTransactionType.FILE_DELETE,
  ]),
  node: new Set([
    BackEndTransactionType.NODE_UPDATE,
    BackEndTransactionType.NODE_DELETE,
    BackEndTransactionType.REGISTERED_NODE_UPDATE,
    BackEndTransactionType.REGISTERED_NODE_DELETE,
  ]),
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
