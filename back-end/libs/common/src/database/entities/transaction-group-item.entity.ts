import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  RelationId,
} from 'typeorm';
import { TransactionGroup, Transaction } from './';

@Entity()
export class TransactionGroupItem {
  @Column()
  seq: number;

  // This is required in addition to transaction because it is the primary column
  @PrimaryColumn()
  transactionId: number;

  @OneToOne(() => Transaction, transaction => transaction.groupItem)
  @JoinColumn()
  transaction: Transaction;

  @ManyToOne(() => TransactionGroup, group => group.groupItems)
  group: TransactionGroup;

  @RelationId((groupItem: TransactionGroupItem) => groupItem.group)
  groupId: number;
}
