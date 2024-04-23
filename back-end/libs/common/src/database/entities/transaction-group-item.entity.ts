import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { TransactionGroup, Transaction } from './';

@Entity()
export class TransactionGroupItem {
  @Column()
  seq: number;

  @PrimaryColumn()
  transactionId: number;

  @OneToOne(() => Transaction, transaction => transaction.groupItem)
  @JoinColumn()
  transaction: Transaction;

  @ManyToOne(() => TransactionGroup, group => group.groupItems)
  group: TransactionGroup;
}