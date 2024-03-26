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

  // Only the base approver(s) should have a transactionId.
  // If the approver has a listId, then transactionId should be null
  @ManyToOne(() => Transaction, (transaction) => transaction.approvers)
  transaction?: Transaction;

  // The parent list, if applicable
  @ManyToOne(
    () => TransactionApprover,
    (approverList) => approverList.approvers,
    { nullable: true },
  )
  list?: TransactionApprover;

  // The threshold of this list, if applicable
  @Column({ nullable: true })
  threshold?: number;

  // The user key of this approver, if applicable
  @ManyToOne(
    () => UserKey,
    (userKey) => userKey.approvedTransactions,
    { nullable: true },
  )
  userKey?: UserKey;

  // The signature created by the user key, if applicable
  @Column({ type: 'bytea', nullable: true })
  signature?: Buffer;

  // The status of approval, if applicable
  @Column({ nullable: true })
  approved?: boolean;

  @OneToMany(() => TransactionApprover, (approver) => approver.list)
  approvers: TransactionApprover[];

  @CreateDateColumn()
  createdAt: Date;
}

// insert into transaction_approver (id, transactionId, listId, threshold, userKeyId, signature, approved) values (1,1,null,2,null,null,null);
// insert into transaction_approver (id, transactionId, listId, threshold, userKeyId, signature, approved) values (2,1,1,null,1,'1',true);
// insert into transaction_approver (id, transactionId, listId, threshold, userKeyId, signature, approved) values (3,1,1,null,2,'2',false);
// insert into transaction_approver (id, transactionId, listId, threshold, userKeyId, signature, approved) values (4,1,1,2,null,null,null);
// insert into transaction_approver (id, transactionId, listId, threshold, userKeyId, signature, approved) values (5,1,4,null,3,'3',null);
// insert into transaction_approver (id, transactionId, listId, threshold, userKeyId, signature, approved) values (6,1,4,null,4,'4',null);
// insert into transaction_approver (id, transactionId, listId, threshold, userKeyId, signature, approved) values (7,1,4,1,null,null,null);
// insert into transaction_approver (id, transactionId, listId, threshold, userKeyId, signature, approved) values (8,1,7,null,5,'5',true);
// insert into transaction_approver (id, transactionId, listId, threshold, userKeyId, signature, approved) values (9,1,7,null,6,'6',false);
