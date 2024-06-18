import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { TransactionGroup, Transaction } from './';

@Entity()
export class TransactionGroupItem {
  @Column()
  seq: number;

  // I believe this is required in addition to transaction because it is the primary column
  @PrimaryColumn()
  transactionId: number;

  // This is added to allow for the groupId to be returned with the transaction
  @Column()
  groupId: number;

  @OneToOne(() => Transaction, transaction => transaction.groupItem)
  @JoinColumn()
  transaction: Transaction;

  @ManyToOne(() => TransactionGroup, group => group.groupItems)
  group: TransactionGroup;
}