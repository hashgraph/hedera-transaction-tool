import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Transaction } from '../';
import { AccountSnapshot } from './';

// Explicit join table that binds a transaction to the exact AccountSnapshot
// version that was current when the transaction reached terminal state. A
// timestamp-based query (snap.createdAt <= tx.executedAt) would fail when a
// key rotates back to a previously seen value: the deduped snapshot row carries
// the original createdAt, so the timestamp query returns the wrong version.
// The explicit ID reference here is immune to that edge case.
@Entity()
@Index(['transactionId', 'keySnapshotId'], { unique: true })
export class TransactionAccountSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  transactionId: number;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  keySnapshotId: number;

  @Column({ default: false })
  isReceiver: boolean;

  @ManyToOne(() => AccountSnapshot, (snap) => snap.transactionLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'keySnapshotId' })
  keySnapshot: AccountSnapshot;
}
