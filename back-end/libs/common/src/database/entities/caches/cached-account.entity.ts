import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn, Index,
} from 'typeorm';
import { CachedAccountKey, TransactionAccount } from './';

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
  receiverSignatureRequired?: boolean;

  @Column({ length: 100, nullable: true })
  etag?: string; // Mirror node etag or hash of response

  @OneToMany(() => CachedAccountKey, (key) => key.account)
  keys: CachedAccountKey[];

  @OneToMany(() => TransactionAccount, (ta) => ta.account)
  accountTransactions: TransactionAccount[];

  @CreateDateColumn()
  createdAt: Date; // For tracking cache life span

  @UpdateDateColumn()
  @Index()
  updatedAt: Date;
}