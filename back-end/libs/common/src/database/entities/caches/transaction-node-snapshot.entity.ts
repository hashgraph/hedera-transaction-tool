import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Transaction } from '../';
import { NodeSnapshot } from './';

// Same rationale as TransactionAccountSnapshot — explicit ID reference rather
// than a timestamp query, to correctly handle node admin key rotations that
// revert to a previously seen key structure.
@Entity()
@Index(['transactionId', 'keySnapshotId'], { unique: true })
export class TransactionNodeSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  transactionId: number;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  keySnapshotId: number;

  @ManyToOne(() => NodeSnapshot, (snap) => snap.transactionLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'keySnapshotId' })
  keySnapshot: NodeSnapshot;
}
