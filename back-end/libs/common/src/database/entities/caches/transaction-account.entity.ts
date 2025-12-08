import { Entity, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { CachedAccount } from './';
import { Transaction } from '../';

@Entity({ name: 'transaction_accounts' })
export class TransactionAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, (tx) => tx.transactionAccounts, {
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