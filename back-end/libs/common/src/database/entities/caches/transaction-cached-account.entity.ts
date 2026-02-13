import { Entity, PrimaryGeneratedColumn, ManyToOne, Index, JoinColumn, Column } from 'typeorm';
import { CachedAccount } from './';
import { Transaction } from '../';

@Entity()
@Index(['transactionId', 'cachedAccountId'], { unique: true })
export class TransactionCachedAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, (tx) => tx.transactionCachedAccounts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  transactionId: number;

  @ManyToOne(() => CachedAccount, (acc) => acc.accountTransactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cachedAccountId' })
  cachedAccount: CachedAccount;

  @Column()
  cachedAccountId: number;
}