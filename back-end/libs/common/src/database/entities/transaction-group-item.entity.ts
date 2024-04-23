import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { TransactionGroup, Transaction } from './';

@Entity()
export class TransactionGroupItem {
  @Column()
  seq: number;

  @PrimaryColumn()
  transactionId: number;

  @OneToOne(() => Transaction, transaction => transaction.groupItem)
  //I see one guy did this one, then in the otherside did the above (longer version)
  // @OneToOne(() => Transaction)
  @JoinColumn()
  transaction: Transaction;

  @ManyToOne(() => TransactionGroup, group => group.items)
  group: TransactionGroup;
}