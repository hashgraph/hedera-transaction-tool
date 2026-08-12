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
import { ReviewerRule } from './reviewer-rule.entity';
import { ReviewerAction } from './reviewer-action.enum';

// The known fields at time of writing — intentionally open-ended as conditions
// will be added here in a future migration without requiring a schema change.
export interface RulePayload {
  hederaEntityId: string;
  network: string;
  entityRole: string | null;
  transactionType: string | null;
  [key: string]: unknown;
}

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

  @Column()
  action: ReviewerAction;

  // Full rule definition at the time of this change: hederaEntityId, network,
  // entityRole, transactionType, and any future fields (e.g. conditions). Stored as
  // jsonb so the schema can grow without a migration when conditions are added.
  // This is the exact payload that attestationSignatures are computed over.
  @Column({ type: 'jsonb' })
  rulePayload: RulePayload;

  // The snapshotVersion of the reviewer_group at the time this change was attested.
  // Null for ADD actions (no attestation required). For REMOVE actions, the client
  // uses this to find the right group snapshot in its locally-held, already-verified
  // group chain — never fetch the group from the backend to perform this lookup, as a
  // compromised backend could supply a different member list. Walk all group changes
  // first so the required snapshot version is already trusted locally before any rule
  // changes are processed.
  @Column({ nullable: true })
  groupSnapshotVersion: number | null;

  // Null for ADD actions — adding a rule only increases coverage and requires no
  // attestation. Required for REMOVE actions.
  //
  // For REMOVE: serialized list of { userKeyId, signature } pairs. Each signature is
  // a cryptographic signature over rulePayload made by a group member's private key.
  //
  // Client verification:
  //   1. From the locally-held group chain, find the snapshot at groupSnapshotVersion.
  //   2. For each { userKeyId, signature } entry: find the matching member in that
  //      snapshot and use their embedded publicKey to verify the signature over
  //      rulePayload.
  //   3. Reject any entry whose userKeyId is not in that snapshot's member list.
  //   4. If the number of valid signatures >= that snapshot's threshold, accept the
  //      change. Never fetch keys or group state from the backend for this check.
  @Column({ type: 'bytea', nullable: true })
  attestationSignatures: Buffer | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
