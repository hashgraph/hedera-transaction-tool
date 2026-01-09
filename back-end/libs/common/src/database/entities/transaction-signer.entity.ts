import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { UserKey } from './user-key.entity';
import { User } from './user.entity';

@Entity()
@Index(['transactionId', 'userKeyId'])
export class TransactionSigner {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, transaction => transaction.signers)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  transactionId: number;

  @ManyToOne(() => UserKey, userKey => userKey.signedTransactions)
  @JoinColumn({ name: 'userKeyId' })
  userKey: UserKey;

  @Column()
  userKeyId: number;

  @ManyToOne(() => User, user => user.signerForTransactions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @CreateDateColumn()
  createdAt: Date;
}
