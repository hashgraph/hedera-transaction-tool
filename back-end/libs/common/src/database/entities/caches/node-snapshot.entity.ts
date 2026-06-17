import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { TransactionNodeSnapshot } from './';

// Same model as AccountSnapshot — append-only history log of a node's admin
// key. A new row is written only when the key changes from the previous
// snapshot; unchanged state reuses the existing row.
// See CachedNodeAdminKey for the B-tree equivalent on live cache data.
@Entity()
@Index(['nodeId', 'mirrorNetwork', 'createdAt'])
export class NodeSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nodeId: number;

  @Column()
  mirrorNetwork: string;

  @Column({ type: 'bytea' })
  encodedKey: Buffer;

  @Column({ length: 64 })
  keyHash: string;

  @Column({ type: 'text', array: true })
  publicKeys: string[];

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => TransactionNodeSnapshot, (link) => link.keySnapshot)
  transactionLinks: TransactionNodeSnapshot[];
}
