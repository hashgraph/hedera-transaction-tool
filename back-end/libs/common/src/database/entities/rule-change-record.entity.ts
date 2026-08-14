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
import { AttestationSignature, ChangeRequestStatus } from './group-change-record.entity';
import { ReviewerGroup } from './reviewer-group.entity';
import { ReviewerRule } from './reviewer-rule.entity';
import { ReviewerAction } from './reviewer-action.enum';
import { User } from './user.entity';
import { UserKey } from './user-key.entity';

// The known fields at time of writing — intentionally open-ended as conditions
// will be added here in a future migration without requiring a schema change.
export interface RulePayload {
  hederaEntityId: string;
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
  id: number;

  @ManyToOne(() => ReviewerRule, rule => rule.changeRecords, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'ruleId' })
  rule: ReviewerRule | null;

  @Column({ nullable: true })
  ruleId: number | null;

  @ManyToOne(() => ReviewerGroup, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'groupId' })
  group: ReviewerGroup | null;

  @Column({ nullable: true })
  groupId: number | null;

  // The admin who proposed this change. Shown to group members so they know who is
  // requesting their approval. Nullable so the audit record survives user deletion —
  // SET NULL on delete preserves the row while dropping the FK reference.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ nullable: true })
  userId: number | null;

  // Which of the proposer's registered keys they used to sign the proposal. Nullable
  // for the same reason as userId — the signature is retained even after key removal.
  @ManyToOne(() => UserKey, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userKeyId' })
  userKey: UserKey | null;

  @Column({ nullable: true })
  userKeyId: number | null;

  // Hex-encoded Ed25519 signature over rulePayload, produced by the proposer's private
  // key. Proves the proposer created this specific request — the backend cannot forge it
  // without access to their private key. Retained even after userId/userKeyId are nulled.
  @Column({ nullable: true })
  userSignature: string | null;

  @Column()
  action: ReviewerAction;

  // ChangeRequestStatus — ADD actions are written directly as APPLIED (no attestation
  // required). REMOVE actions start as PENDING while signatures accumulate, then
  // transition to APPLIED once the group threshold is met.
  @Column()
  status: ChangeRequestStatus;

  // Full rule definition at the time of this change: hederaEntityId, network,
  // entityRole, transactionType, and any future fields (e.g. conditions). Stored as
  // jsonb so the schema can grow without a migration when conditions are added.
  // For REMOVE actions this is the exact payload that attestationSignatures are
  // computed over.
  @Column({ type: 'jsonb' })
  rulePayload: RulePayload;

  // The snapshotVersion of the reviewer_group when this record was created.
  // Null for ADD actions (no attestation required). For REMOVE actions, the client
  // uses this to find the right group snapshot in its locally-held, already-verified
  // group chain — never fetch the group from the backend for this lookup, as a
  // compromised backend could supply a different member list. Walk all group changes
  // first so the required snapshot version is already trusted locally before any rule
  // changes are processed.
  @Column({ nullable: true })
  groupSnapshotVersion: number | null;

  // Null for ADD actions. For REMOVE actions: accumulated member votes starting as [].
  // Each entry's signature covers { vote, rulePayload } so neither the vote nor the
  // content can be tampered with by the backend. The first 'reject' entry moves status
  // to REJECTED immediately. Once 'approve' count >= group threshold, status moves to
  // APPLIED.
  //
  // Client verification (APPLIED REMOVE records only):
  //   1. From the locally-held group chain, find the snapshot at groupSnapshotVersion.
  //   2. For each entry: find the matching member in that snapshot and use their
  //      embedded publicKey to verify the signature over { vote, rulePayload }:
  //      PublicKey.fromString(publicKey).verify({ vote, rulePayload }, Buffer.from(signature, 'hex'))
  //   3. Reject any entry whose userKeyId is not in that snapshot's member list.
  //   4. If 'approve' count >= that snapshot's threshold, accept the change.
  //      Never fetch keys or group state from the backend for this check.
  @Column({ type: 'jsonb', nullable: true })
  attestationSignatures: AttestationSignature[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // For APPLIED records this is the moment the change was committed — the row is
  // immutable after that point, so updatedAt doubles as appliedAt.
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
