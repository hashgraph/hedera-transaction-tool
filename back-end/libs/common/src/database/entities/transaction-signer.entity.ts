import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { UserKey } from './user-key.entity';

@Entity()
export class TransactionSigner {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, (transaction) => transaction.signers)
  transaction: Transaction;

  @ManyToOne(() => UserKey, (userKey) => userKey.signedTransactions)
  userKey: UserKey;

  @Column({ type: 'bytea'})
  signature: Buffer;

  @CreateDateColumn()
  createdAt: Date;
}
