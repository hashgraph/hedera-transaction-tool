import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';

export const MAX_TRANSACTION_COMMENT_LENGTH = 2000;

@Entity()
export class TransactionComment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, transaction => transaction.comments)
  transaction: Transaction;

  @ManyToOne(() => User, user => user.comments)
  user: User;

  @Column({ length: MAX_TRANSACTION_COMMENT_LENGTH })
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}
