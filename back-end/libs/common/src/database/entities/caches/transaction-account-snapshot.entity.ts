import { Entity, PrimaryGeneratedColumn, ManyToOne, Index, JoinColumn, Column } from 'typeorm';
import { AccountSnapshot } from './account-snapshot.entity';
import { Transaction } from '../';

@Entity()
@Index(['transactionId', 'accountSnapshotId'], { unique: true })
export class TransactionAccountSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, (tx) => tx.transactionAccountSnapshots, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  transactionId: number;

  @ManyToOne(() => AccountSnapshot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountSnapshotId' })
  accountSnapshot: AccountSnapshot;

  @Column()
  accountSnapshotId: number;

  @Column({ default: false })
  isReceiver: boolean;
}
