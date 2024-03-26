import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Tree,
  TreeChildren,
  TreeParent,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { UserKey } from './user-key.entity';

@Entity()
@Tree('nested-set')
export class TransactionApproverNestedSet {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, (transaction) => transaction.approvers)
  transaction: Transaction;

  @TreeParent()
  list?: TransactionApproverNestedSet;

  @Column({ nullable: true })
  threshold?: number;

  @ManyToOne(() => UserKey, (userKey) => userKey.approvedTransactions, {
    nullable: true,
  })
  userKey?: UserKey;

  @Column({ type: 'bytea', nullable: true })
  signature?: Buffer;

  @Column({ nullable: true })
  approved?: boolean;

  @TreeChildren()
  approvers: TransactionApproverNestedSet[];

  @CreateDateColumn()
  createdAt: Date;
}
