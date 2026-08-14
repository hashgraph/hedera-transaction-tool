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

export enum GroupChangeType {
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum ChangeRequestStatus {
  PENDING = 'PENDING',
  APPLIED = 'APPLIED',
  REJECTED = 'REJECTED',
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

// One entry per member response. vote and signature together are what the member
// produces — the signature is computed over { vote, snapshotPayload } so the backend
// cannot flip a reject to an approve without invalidating the signature.
export interface AttestationSignature {
  userKeyId: number;
  vote: 'approve' | 'reject';
  signature: string;
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
// Chain-walking: to bring a local group state up to date, the client fetches all
// records WHERE status = 'APPLIED' AND snapshotVersion > localVersion
// ORDER BY snapshotVersion ASC, then processes them one step at a time:
//   1. The prior member list is whatever the client holds for snapshotVersion - 1.
//      Each member entry includes the publicKey — use those directly for verification.
//      Never fetch public keys from the backend; a compromised backend could swap keys.
//   2. For each attestationSignature, verify the signature over { vote, snapshotPayload }.
//   3. If the count of valid 'approve' signatures >= threshold from snapshotVersion - 1,
//      accept the new state and advance localVersion.
//   4. Repeat for the next record using the member list just accepted.
//
// Each snapshotPayload is the COMPLETE group state at the time of the change:
//   UPDATE — the new state (name, description, threshold, member list with public keys).
//   DELETE — the final state before deletion; public keys are embedded so the chain
//            remains self-contained even past the group's deletion.
//
// The first record (group creation, snapshotVersion=1) is the trust anchor. It is
// created by an admin with no prior members to attest it; the client must receive it
// over a trusted channel (e.g. initial app setup or admin-verified import).
@Entity()
@Index(['groupId'])
export class GroupChangeRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ReviewerGroup, group => group.changeRecords, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'groupId' })
  group: ReviewerGroup | null;

  @Column({ nullable: true })
  groupId: number | null;

  // The admin who proposed this change. Shown to group members so they know who is
  // requesting their approval. Non-nullable — users are soft-deleted, so this reference
  // is always valid.
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  // Which of the proposer's registered keys they used to sign the proposal. Nullable
  // for the same reason as userId — the signature itself is retained even after the
  // key is removed, so callers can still prove who initiated the change.
  @ManyToOne(() => UserKey, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userKeyId' })
  userKey: UserKey | null;

  @Column({ nullable: true })
  userKeyId: number | null;

  // Hex-encoded Ed25519 signature over snapshotPayload, produced by the proposer's
  // private key. Proves the proposer created this specific request — the backend cannot
  // forge it without access to their private key. Intentionally not a FK so it is never
  // nulled; the signature remains verifiable even after userId/userKeyId are cleared.
  @Column({ nullable: true })
  userSignature: string | null;

  // GroupChangeType — UPDATE or DELETE.
  @Column()
  type: GroupChangeType;

  // ChangeRequestStatus — PENDING while votes are being collected; APPLIED once the
  // approve threshold is met; REJECTED as soon as any member votes to reject.
  @Column()
  status: ChangeRequestStatus;

  // Pre-assigned as currentVersion + 1 when the request is created. Because at most
  // one PENDING record exists per group at a time, the next version is unambiguous.
  // The prior version (needed for client signature verification) is always
  // snapshotVersion - 1; no separate column is required.
  @Column()
  snapshotVersion: number;

  // Full group state at the time of this change (see class comment for UPDATE vs DELETE
  // semantics). Public keys are embedded so the audit chain is self-contained.
  @Column({ type: 'jsonb' })
  snapshotPayload: GroupSnapshot;

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
  attestationSignatures: AttestationSignature[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // For APPLIED/REJECTED records this is the moment the status transitioned — the row
  // is immutable after that point, so updatedAt doubles as appliedAt/rejectedAt.
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
