import { Entity, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { CachedAccount } from './';
import { Transaction } from '../';

@Entity()
@Index(['transaction', 'account'], { unique: true })
export class TransactionCachedAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, (tx) => tx.transactionCachedAccounts, {
    onDelete: 'CASCADE',
  })
  @Index()
  transaction: Transaction;

  @ManyToOne(() => CachedAccount, (acc) => acc.accountTransactions, {
    onDelete: 'CASCADE',
  })
  @Index()
  account: CachedAccount;
}