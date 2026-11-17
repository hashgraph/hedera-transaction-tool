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
import { ReviewerGroup } from './reviewer-group.entity';
import { User } from './user.entity';
import { UserKey } from './user-key.entity';
import { AttestationSignature, ChangeRequestStatus } from './change-record.types';

export enum GroupChangeType {
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export interface GroupSnapshotMember {
  userId: number;
  userKeyId: number;
  publicKey: string;
}

export interface GroupSnapshot {
  name: string;
  description: string | null;
  threshold: number;
  members: GroupSnapshotMember[];
}

// Audit log of every group mutation; rows start PENDING and transition to APPLIED or
// REJECTED. Cancelled change requests are deleted outright — they never appear here.
//
// Lifecycle:
//   PENDING  — created when an admin initiates an update or delete. snapshotVersion is
//              pre-assigned as currentVersion + 1. Members submit approve/reject votes
//              individually. The first reject immediately moves the record to REJECTED.
//              Once approve count >= group threshold the record moves to APPLIED.
//   APPLIED  — the change has been committed. The row is now part of the immutable audit
//              chain and will not be modified again.
//   REJECTED — a group member voted to reject. The row is retained for audit but the
//              change will never be applied. Status is terminal.
//
// At most one PENDING record may exist per groupId at any time (enforced by a partial
// unique index — see the migration). TypeORM cannot express partial indexes via
// decorators, so the constraint lives only in the DB.
//
// Each snapshotPayload is the COMPLETE group state at the time of the change:
//   UPDATE — the new state (name, description, threshold, member list with public keys).
//   DELETE — the final state before deletion; public keys are embedded so the record
//            stays self-contained even past the group's deletion.
//
// The org backend is trusted for group/rule data; clients do not replay this history to
// verify it. The attestation signatures are kept as an audit record.
@Entity()
@Index(['groupId'])
export class GroupChangeRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => ReviewerGroup, group => group.changeRecords, {
    nullable: true,
    onDelete: 'SET NULL',
  })
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

  // Hex-encoded Ed25519 signature over snapshotPayload, produced by the proposer's
  // private key. Stored for audit; not currently verified. Intentionally not a FK so it
  // is never nulled.
  @Column({ type: String, nullable: true })
  userSignature!: string | null;

  // GroupChangeType — UPDATE or DELETE.
  @Column()
  type!: GroupChangeType;

  // ChangeRequestStatus — PENDING while votes are being collected; APPLIED once the
  // approve threshold is met; REJECTED as soon as any member votes to reject.
  @Column()
  status!: ChangeRequestStatus;

  // Pre-assigned as currentVersion + 1 when the request is created. Because at most
  // one PENDING record exists per group at a time, the next version is unambiguous.
  // The prior version is always snapshotVersion - 1; no separate column is required.
  @Column()
  snapshotVersion!: number;

  // Full group state at the time of this change (see class comment for UPDATE vs DELETE
  // semantics). Public keys are embedded so the audit chain is self-contained.
  @Column({ type: 'jsonb' })
  snapshotPayload!: GroupSnapshot;

  // Accumulated member votes. Starts as [] when the request is created; a new entry is
  // appended each time a member submits their vote. Each entry's signature covers
  // { vote, snapshotPayload } so neither the vote nor the content can be tampered with.
  // The first 'reject' entry moves status to REJECTED immediately. Once 'approve' count
  // >= threshold from snapshotVersion - 1, status moves to APPLIED.
  //
  // Client verification (APPLIED records only):
  //   1. For each entry: look up the publicKey for that userKeyId from the locally-held
  //      snapshotVersion - 1 member list.
  //   2. Verify: PublicKey.fromString(publicKey).verify(
  //        { vote, snapshotPayload }, Buffer.from(signature, 'hex'))
  //   3. Reject any entry whose userKeyId is not in that member list.
  //   4. If 'approve' count >= that version's threshold, accept the new state.
  //      Never fetch public keys from the backend for this check.
  @Column({ type: 'jsonb' })
  attestationSignatures!: AttestationSignature[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // For APPLIED/REJECTED records this is the moment the status transitioned — the row
  // is immutable after that point, so updatedAt doubles as appliedAt/rejectedAt.
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
