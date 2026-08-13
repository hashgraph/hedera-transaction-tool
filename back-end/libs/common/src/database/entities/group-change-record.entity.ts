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

export enum GroupChangeType {
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum ChangeRequestStatus {
  PENDING = 'PENDING',
  APPLIED = 'APPLIED',
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

// One entry per signing member. signature is the hex-encoded Ed25519 signature
// bytes produced by PrivateKey.sign() over the attested payload.
export interface AttestationSignature {
  userKeyId: number;
  signature: string;
}

// Audit log of every group mutation; rows start PENDING and transition to APPLIED.
// Cancelled change requests are deleted outright — they never appear here.
//
// Lifecycle:
//   PENDING — created when an admin initiates an update or delete. snapshotVersion is
//             pre-assigned as currentVersion + 1. Members submit signatures individually
//             until attestationSignatures.length reaches the group's threshold, at which
//             point the backend applies the change and flips status to APPLIED.
//   APPLIED — the change has been committed. The row is now part of the immutable audit
//             chain and will not be modified again.
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
//   2. Verify each signature in attestationSignatures over snapshotPayload.
//   3. If the count of valid signatures >= threshold from snapshotVersion - 1, accept
//      the new state and advance localVersion.
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

  // GroupChangeType — UPDATE or DELETE.
  @Column()
  type: GroupChangeType;

  // ChangeRequestStatus — PENDING while signatures are being collected; APPLIED once
  // the threshold is met and the change has been committed.
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

  // Accumulated { userKeyId, signature } pairs. Starts as [] when the request is
  // created; a new entry is appended each time a member submits their signature.
  // Once length >= threshold from snapshotVersion - 1, the change is applied.
  //
  // Client verification (APPLIED records only):
  //   1. For each { userKeyId, signature } entry: look up the publicKey for that
  //      userKeyId from the locally-held snapshotVersion - 1 member list.
  //   2. Verify: PublicKey.fromString(publicKey).verify(payload, Buffer.from(signature, 'hex'))
  //   3. Reject any entry whose userKeyId is not in that member list.
  //   4. If valid signature count >= that version's threshold, accept the new state.
  //      Never fetch public keys from the backend for this check.
  @Column({ type: 'jsonb' })
  attestationSignatures: AttestationSignature[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // For APPLIED records this is the moment the change was committed — the row is
  // immutable after that point, so updatedAt doubles as appliedAt.
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
