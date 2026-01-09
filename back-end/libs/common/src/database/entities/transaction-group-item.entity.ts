import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { TransactionGroup, Transaction } from './';

@Entity()
@Index(['transaction', 'group'])
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
  @JoinColumn({ name: 'groupId' })
  group: TransactionGroup;

  @Column()
  groupId: number;
}
