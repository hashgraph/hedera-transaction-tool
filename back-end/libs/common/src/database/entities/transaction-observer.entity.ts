import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Transaction } from './transaction.entity';

export enum Role {
  APPROVER = 'APPROVER', // Can only observe the approver interactions
  STATUS = 'STATUS', // Can only observe the status of the transaction
  FULL = 'FULL', // Can observe all information of the transaction
}

@Entity()
@Index(['userId', 'transactionId'], { unique: true })
@Index(['transactionId'])
@Index(['userId'])
export class TransactionObserver {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  role: Role;

  @ManyToOne(() => User, user => user.observableTransactions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => Transaction, transaction => transaction.observers)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  transactionId: number;

  @CreateDateColumn()
  createdAt: Date;
}
