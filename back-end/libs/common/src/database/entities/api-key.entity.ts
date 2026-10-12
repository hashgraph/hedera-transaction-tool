import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum ApiKeyRevokedReason {
  USER = 'user',
  PERMISSION_REMOVED = 'permission_removed',
  USER_REMOVED = 'user_removed',
  INACTIVITY = 'inactivity',
}

// A read-only, revocable API key for a single user, used by external report consumers in
// place of handing out a human admin's password/JWT. At most one key exists per user —
// regenerating replaces keyId/secretHash on this same row rather than inserting a new
// one, so the previous key is invalid immediately with no overlap window.
//
// Only keyId and a SHA-256 hash of the secret are stored; the full key string
// (`tt_<keyId>_<secret>`) is only ever returned once, at creation or regeneration time.
// The secret is 256 bits of crypto.randomBytes, so a fast hash is appropriate — unlike a
// human password, there is nothing low-entropy to protect against brute force.
@Entity()
export class ApiKey {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ unique: true })
  userId!: number;

  @Column({ unique: true })
  keyId!: string;

  @Column()
  secretHash!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // Updated on successful use, throttled to at most once/hour so reads don't become
  // writes on every request. Used together with createdAt for the idle expiry
  // (API_KEY_IDLE_EXPIRY_DAYS).
  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: String, nullable: true })
  lastUsedIp!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: String, nullable: true })
  revokedReason!: ApiKeyRevokedReason | null;
}
