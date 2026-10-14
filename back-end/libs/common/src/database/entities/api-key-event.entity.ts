import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiKey, ApiKeyRevokedReason } from './api-key.entity';
import { User } from './user.entity';

export enum ApiKeyEventType {
  CREATED = 'created',
  REGENERATED = 'regenerated',
  REVOKED = 'revoked',
  PERMISSION_REMOVED = 'permission_removed',
  EXPIRED = 'expired',
  AUTH_FAILED = 'auth_failed',
}

// Append-only audit log of API key lifecycle events, following the same shape
// convention as GroupChangeRecord/RuleChangeRecord. apiKeyId is nullable/SET NULL so
// events survive even if the key row is ever hard-deleted (e.g. cascade from user
// deletion); userId is kept alongside it for the same reason.
@Entity()
@Index(['apiKeyId'])
@Index(['userId'])
export class ApiKeyEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => ApiKey, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'apiKeyId' })
  apiKey!: ApiKey | null;

  @Column({ nullable: true })
  apiKeyId!: number | null;

  // The key owner. Non-nullable — users are soft-deleted, so this reference is always
  // valid even after the key row itself has been removed.
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: number;

  // Who triggered the event — an admin acting on another user's key, or the key owner
  // themself. Null for system-driven events (inactivity expiry).
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'performedBy' })
  performedByUser!: User | null;

  @Column({ nullable: true })
  performedBy!: number | null;

  @Column()
  eventType!: ApiKeyEventType;

  @Column({ type: String, nullable: true })
  reason!: ApiKeyRevokedReason | null;

  @Column({ type: String, nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
