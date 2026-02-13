import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn, Index,
} from 'typeorm';
import { CachedNodeAdminKey, TransactionCachedNode } from './';

@Entity()
@Index(['nodeId', 'mirrorNetwork'], { unique: true })
export class CachedNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  nodeId: number;

  @Column({ length: 64, nullable: true })
  @Index()
  nodeAccountId: string | null;

  @Column()
  mirrorNetwork: string;

  @Column({ type: 'bytea', nullable: true })
  encodedKey: Buffer | null;

  @Column({ length: 100, nullable: true })
  etag: string | null; // Mirror node etag or hash of response

  @OneToMany(() => CachedNodeAdminKey, (key) => key.cachedNode)
  keys: CachedNodeAdminKey[];

  @OneToMany(() => TransactionCachedNode, (tn) => tn.cachedNode)
  nodeTransactions: TransactionCachedNode[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  @Index()
  updatedAt: Date; // Auto-updates on ANY save - serves dual purpose:
                   // 1. Last time data was checked/refreshed from mirror node
                   // 2. Timestamp for when refreshToken was set (for stale lock detection)

  @Column({ type: 'uuid', nullable: true })
  @Index()
  refreshToken: string | null;
}