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

  @Column({ length: 64 })
  @Index()
  nodeAccountId: string;

  @Column()
  mirrorNetwork: string;

  @Column({ type: 'bytea', nullable: true })
  encodedKey: Buffer | null;

  @Column({ length: 100, nullable: true })
  etag: string | null; // Mirror node etag or hash of response

  @OneToMany(() => CachedNodeAdminKey, (key) => key.node)
  keys: CachedNodeAdminKey[];

  @OneToMany(() => TransactionCachedNode, (tn) => tn.node)
  nodeTransactions: TransactionCachedNode[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  @Index()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null; // For tracking when the account was last verified

  @Column({ type: 'uuid', nullable: true })
  @Index()
  refreshToken: string | null;
}