import {
  Column,
  CreateDateColumn,
  Entity,
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
export class TransactionObserver {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.observableTransactions)
  user: User;

  @Column()
  role: Role;

  @ManyToOne(() => Transaction, (transaction) => transaction.observers)
  transaction: Transaction;

  @CreateDateColumn()
  createdAt: Date;
}

//insert into transaction_observer("id", "role", "createdAt", "userId", "transactionId") values (1,'FULL',now(), 1, 1)
