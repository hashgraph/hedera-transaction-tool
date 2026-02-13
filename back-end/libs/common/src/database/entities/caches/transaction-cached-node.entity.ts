import { Entity, PrimaryGeneratedColumn, ManyToOne, Index, JoinColumn, Column } from 'typeorm';
import { CachedNode } from './';
import { Transaction } from '../';

@Entity()
@Index(['transactionId', 'cachedNodeId'], { unique: true })
export class TransactionCachedNode {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, (tx) => tx.transactionCachedNodes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  transactionId: number;

  @ManyToOne(() => CachedNode, (node) => node.nodeTransactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cachedNodeId' })
  cachedNode: CachedNode;

  @Column()
  cachedNodeId: number;
}