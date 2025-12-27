import { Entity, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { CachedNode } from './';
import { Transaction } from '../';

@Entity()
@Index(['transaction', 'node'], { unique: true })
export class TransactionCachedNode {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, (tx) => tx.transactionNodes, {
    onDelete: 'CASCADE',
  })
  @Index()
  transaction: Transaction;

  @ManyToOne(() => CachedNode, (node) => node.nodeTransactions, {
    onDelete: 'CASCADE',
  })
  @Index()
  node: CachedNode;
}