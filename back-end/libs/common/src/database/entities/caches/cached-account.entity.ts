import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { CachedAccountKey, TransactionCachedAccount } from './';

/**
 * CachedAccount entity represents a cached Hedera account with its properties and relationships.
 * These accounts can include: fee payer, transfer sender/receiver, node account, etc.
 */
@Entity()
@Index(['account', 'mirrorNetwork'], { unique: true })
export class CachedAccount {
  @PrimaryGeneratedColumn()
  id: number;

  // Hedera ID (shard.realm.num or null)
  @Column({ length: 64 })
  @Index()
  account: string;

  @Column()
  mirrorNetwork: string;

  @Column({ nullable: true })
  receiverSignatureRequired: boolean | null;

  @Column({ type: 'bytea', nullable: true })
  encodedKey: Buffer | null;

  @Column({ length: 100, nullable: true })
  etag: string | null; // Mirror node etag or hash of response

  @OneToMany(() => CachedAccountKey, (key) => key.account)
  keys: CachedAccountKey[];

  @OneToMany(() => TransactionCachedAccount, (ta) => ta.account)
  accountTransactions: TransactionCachedAccount[];

  @CreateDateColumn()
  createdAt: Date; // For tracking cache life span

  @UpdateDateColumn()
  @Index()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null; // For tracking when the account was last verified

  @Column({ type: 'uuid', nullable: true })
  @Index()
  refreshToken: string | null;
}
