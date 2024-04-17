import { CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Transaction } from './transaction.entity';
import { UserKey } from './user-key.entity';
import { User } from './user.entity';

@Entity()
export class TransactionSigner {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, transaction => transaction.signers, { eager: true })
  transaction: Transaction;

  @ManyToOne(() => UserKey, userKey => userKey.signedTransactions, { eager: true })
  userKey: UserKey;

  @ManyToOne(() => User, user => user.signerForTransactions)
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
