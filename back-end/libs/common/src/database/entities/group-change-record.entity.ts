import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReviewerGroup } from './reviewer-group.entity';

// Append-only audit log of every group mutation. Never deleted.
//
// Chain-walking: to bring a local group state up to date, the client fetches all
// records WHERE snapshotVersion > localVersion ORDER BY snapshotVersion ASC, then
// processes them one step at a time:
//   1. Take the member list the client already holds for the current localVersion.
//      Each member entry includes the publicKey — use those directly for verification.
//      Never fetch public keys from the backend to verify a record; a compromised
//      backend could swap keys to forge attestations.
//   2. Verify attestationPayload was signed by a threshold of those members over
//      snapshotPayload (the full new group state).
//   3. If valid, replace local state with snapshotPayload and advance localVersion.
//   4. Repeat for the next record using the member list just accepted.
//
// Each snapshotPayload is the COMPLETE new group state (name, description, threshold,
// and member list with userId, userKeyId, AND publicKey for each member). The public
// keys are embedded so the chain is self-contained — the client never needs a backend
// lookup to verify any record after the first.
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

  // Monotonically increasing version of the group state after this change.
  // The previous version is always snapshotVersion - 1.
  @Column()
  snapshotVersion: number;

  // Full group state after this change: name, description, threshold, and member list
  // with { userId, userKeyId, publicKey } per member. Public keys are embedded so the
  // client can verify the next record's attestation without trusting the backend.
  @Column({ type: 'jsonb' })
  snapshotPayload: object;

  // Serialized list of { userKeyId, signature } pairs. Each signature is a
  // cryptographic signature over snapshotPayload made by that member's private key.
  // The list must contain enough valid signatures to meet the threshold from the
  // previous version.
  //
  // Client verification:
  //   1. For each { userKeyId, signature } entry: look up the publicKey for that
  //      userKeyId from the locally-held previous-version member list.
  //   2. Verify the signature over snapshotPayload using that publicKey.
  //   3. Reject any entry whose userKeyId is not in the local member list — signatures
  //      from unknown keys do not count toward the threshold.
  //   4. If the number of valid signatures >= previous version's threshold, accept the
  //      new state. Never fetch public keys from the backend for this check.
  @Column({ type: 'bytea' })
  attestationSignatures: Buffer;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
