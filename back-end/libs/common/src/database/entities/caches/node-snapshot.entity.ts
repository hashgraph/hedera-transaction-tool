import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

// Same changelog model as AccountSnapshot — append-only history of a node's
// admin key. A new row is written only when the key changes from the previous
// snapshot; unchanged state reuses the existing row.
//
// createdAt is set to the triggering transaction's executedAt so that the
// standard lookup query works correctly:
//   SELECT ... WHERE nodeId = ? AND mirrorNetwork = ?
//     AND createdAt <= :executedAt ORDER BY createdAt DESC LIMIT 1
//
// There is intentionally NO unique constraint on keyHash — same reasoning as
// AccountSnapshot: a key rotation A→B→A produces three rows with distinct
// createdAt values, and dedup-by-hash would break the timestamp lookup.
//
// Note: the Hedera mirror node does not expose timestamp-based node key
// history, so this snapshot table is the only reliable historical record
// of node admin key changes for signer-reporting queries.
// See CachedNodeAdminKey for the B-tree equivalent used on live cache data.
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

  // Set to the triggering transaction's executedAt — not DEFAULT now() — so
  // that timestamp-range lookups land on the correct snapshot row.
  @Column({ type: 'timestamptz' })
  createdAt: Date;
}
