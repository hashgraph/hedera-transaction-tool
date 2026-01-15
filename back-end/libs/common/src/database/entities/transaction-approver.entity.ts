import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { UserKey } from './user-key.entity';
import { User } from './user.entity';

@Entity()
@Index(['transactionId'])
@Index(['userId'])
export class TransactionApprover {
  @PrimaryGeneratedColumn()
  id: number;

  /* If the approver has a listId, then transactionId should be null */
  @ManyToOne(() => Transaction, transaction => transaction.approvers, {
    nullable: true,
  })
  @JoinColumn({ name: 'transactionId' })
  transaction?: Transaction;

  @Column({ nullable: true })
  transactionId?: number;

  @ManyToOne(() => TransactionApprover, approverList => approverList.approvers, {
    nullable: true,
  })
  @JoinColumn({ name: 'listId' })
  list?: TransactionApprover;

  @Column({ nullable: true })
  listId?: number;

  @Column({ nullable: true })
  threshold?: number;

  @ManyToOne(() => UserKey, userKey => userKey.approvedTransactions, { nullable: true })
  @JoinColumn({ name: 'userKeyId' })
  userKey?: UserKey;

  @Column({ nullable: true })
  userKeyId?: number;

  @Column({ type: 'bytea', nullable: true })
  signature?: Buffer;

  @ManyToOne(() => User, user => user.approvableTransactions, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ nullable: true })
  userId?: number;

  @Column({ nullable: true })
  approved?: boolean;

  @OneToMany(() => TransactionApprover, approver => approver.list)
  approvers: TransactionApprover[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
