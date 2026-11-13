import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AttestationSignature, ChangeRequestStatus } from './change-record.types';
import { ReviewerGroup } from './reviewer-group.entity';
import { ReviewerRule } from './reviewer-rule.entity';
import { ReviewerAction } from './reviewer-action.enum';
import { User } from './user.entity';
import { UserKey } from './user-key.entity';

// The known fields at time of writing — intentionally open-ended as conditions
// will be added here in a future migration without requiring a schema change.
export interface RulePayload {
  // A Hedera entity ID (e.g. "0.0.1234") for most entityRoles, or a plain node ID
  // (e.g. "1") when entityRole is 'node'.
  hederaId: string;
  network: string;
  entityRole: string | null;
  transactionType: string | null;
  [key: string]: unknown;
}

// Audit log of rule mutations; rows start PENDING (for REMOVE actions) and transition
// to APPLIED or REJECTED. ADD actions require no attestation and are written directly
// as APPLIED. Cancelled REMOVE requests are deleted outright — they never appear here.
//
// At most one PENDING record may exist per ruleId at any time (enforced by a partial
// unique index — see the migration). TypeORM cannot express partial indexes via
// decorators, so the constraint lives only in the DB.
@Entity()
@Index(['ruleId'])
@Index(['groupId'])
export class RuleChangeRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => ReviewerRule, rule => rule.changeRecords, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'ruleId' })
  rule!: ReviewerRule | null;

  @Column({ nullable: true })
  ruleId!: number | null;

  @ManyToOne(() => ReviewerGroup, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'groupId' })
  group!: ReviewerGroup | null;

  @Column({ nullable: true })
  groupId!: number | null;

  // The admin who proposed this change. Shown to group members so they know who is
  // requesting their approval. Non-nullable — users are soft-deleted, so this reference
  // is always valid.
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: number;

  // Which of the proposer's registered keys they used to sign the proposal.
  // Non-nullable — user keys are soft-deleted, so this reference is always valid.
  @ManyToOne(() => UserKey)
  @JoinColumn({ name: 'userKeyId' })
  userKey!: UserKey;

  @Column()
  userKeyId!: number;

  // Hex-encoded Ed25519 signature over rulePayload, produced by the proposer's private
  // key. Stored for audit; not currently verified.
  @Column({ type: String, nullable: true })
  userSignature!: string | null;

  @Column()
  action!: ReviewerAction;

  // ChangeRequestStatus — ADD actions are written directly as APPLIED (no attestation
  // required). REMOVE actions start as PENDING while signatures accumulate, then
  // transition to APPLIED once the group threshold is met.
  @Column()
  status!: ChangeRequestStatus;

  // Full rule definition at the time of this change: hederaId, network,
  // entityRole, transactionType, and any future fields (e.g. conditions). Stored as
  // jsonb so the schema can grow without a migration when conditions are added.
  // For REMOVE actions this is the exact payload that attestationSignatures are
  // computed over.
  @Column({ type: 'jsonb' })
  rulePayload!: RulePayload;

  // The snapshotVersion of the reviewer_group when this record was created.
  // Null for ADD actions (no attestation required). For REMOVE actions, identifies the
  // group snapshot whose members and threshold the attestations were collected against.
  @Column({ type: Number, nullable: true })
  groupSnapshotVersion!: number | null;

  // Null for ADD actions. For REMOVE actions: accumulated member votes starting as [].
  // Each entry's signature covers { vote, rulePayload }. The first 'reject' entry moves
  // status to REJECTED immediately. Once 'approve' count >= group threshold, status moves
  // to APPLIED. Kept as an audit record; clients do not re-verify it.
  @Column({ type: 'jsonb', nullable: true })
  attestationSignatures!: AttestationSignature[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // For APPLIED records this is the moment the change was committed — the row is
  // immutable after that point, so updatedAt doubles as appliedAt.
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
