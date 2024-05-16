import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Transaction } from './transaction.entity';

export enum Role {
  APPROVER = 'APPROVER', // Can only observe the approver interactions
  STATUS = 'STATUS', // Can only observe the status of the transaction
  FULL = 'FULL', // Can observe all information of the transaction
}

@Entity()
export class TransactionObserver {
  @Column()
  @Generated('increment')
  id: number;

  @Column()
  role: Role;

  @ManyToOne(() => User, user => user.observableTransactions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @PrimaryColumn()
  userId: number;

  @ManyToOne(() => Transaction, transaction => transaction.observers)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @PrimaryColumn()
  transactionId: number;

  @CreateDateColumn()
  createdAt: Date;
}
