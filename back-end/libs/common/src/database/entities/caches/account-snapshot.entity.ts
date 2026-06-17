import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { TransactionAccountSnapshot } from './';

// Append-only history log of an account's key structure. A new row is written
// each time the key or receiverSignatureRequired changes at transaction terminal
// state; if the state is unchanged from the previous snapshot, the existing row
// is reused. This produces a readable changelog of key rotations over time.
// The GIN index on publicKeys enables fast containment lookups ("find all
// snapshots that include public key X") with a one-time write cost per row.
// See CachedAccountKey for the B-tree equivalent used on live cache data.
@Entity()
@Index(['account', 'mirrorNetwork', 'createdAt'])
export class AccountSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64 })
  account: string;

  @Column()
  mirrorNetwork: string;

  @Column({ type: 'bytea' })
  encodedKey: Buffer;

  @Column({ length: 64 })
  keyHash: string;

  @Column({ type: 'text', array: true })
  publicKeys: string[];

  @Column({ default: false })
  receiverSignatureRequired: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => TransactionAccountSnapshot, (link) => link.keySnapshot)
  transactionLinks: TransactionAccountSnapshot[];
}
