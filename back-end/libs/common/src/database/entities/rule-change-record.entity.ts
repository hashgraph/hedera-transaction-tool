import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReviewerGroup } from './reviewer-group.entity';
import { ReviewerRule } from './reviewer-rule.entity';
import { ReviewerAction } from './reviewer-action.enum';

@Entity()
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
  rulePayload: object;

  // Null for ADD actions — adding a rule only increases coverage and requires no
  // attestation. Required for REMOVE actions.
  //
  // For REMOVE: serialized list of { userKeyId, signature } pairs. Each signature is
  // a cryptographic signature over rulePayload made by a group member's private key.
  //
  // Client verification:
  //   1. For each { userKeyId, signature } entry: look up the publicKey for that
  //      userKeyId from the locally-held current group member list.
  //   2. Verify the signature over rulePayload using that publicKey.
  //   3. Reject any entry whose userKeyId is not in the local member list.
  //   4. If the number of valid signatures >= the group's threshold, accept the
  //      removal. Never fetch public keys from the backend for this check.
  @Column({ type: 'bytea', nullable: true })
  attestationSignatures: Buffer | null;

  @CreateDateColumn()
  createdAt: Date;
}
