import { Entity, PrimaryGeneratedColumn, ManyToOne, Index, JoinColumn, Column } from 'typeorm';
import { NodeSnapshot } from './node-snapshot.entity';
import { Transaction } from '../';

@Entity()
@Index(['transactionId', 'nodeSnapshotId'], { unique: true })
export class TransactionNodeSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, (tx) => tx.transactionNodeSnapshots, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  transactionId: number;

  @ManyToOne(() => NodeSnapshot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nodeSnapshotId' })
  nodeSnapshot: NodeSnapshot;

  @Column()
  nodeSnapshotId: number;
}
