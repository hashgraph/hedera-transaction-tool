import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { UserKey } from './user-key.entity';

@Entity()
export class TransactionApprover {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, (transaction) => transaction.approvers)
  transaction: Transaction;

  @ManyToOne(
    () => TransactionApprover,
    (approverList) => approverList.approvers,
    { nullable: true },
  )
  list?: TransactionApprover;

  @Column({ nullable: true })
  threshold?: number;

  @ManyToOne(
    () => UserKey,
    (userKey) => userKey.approvedTransactions,
    { nullable: true },
  )
  userKey?: UserKey;

  @Column({ nullable: true })
  signature?: Buffer;

  @Column({ nullable: true })
  approved?: boolean;

  @OneToMany(() => TransactionApprover, (approver) => approver.list)
  approvers: TransactionApprover[];

  @CreateDateColumn()
  createdAt: Date;
}
