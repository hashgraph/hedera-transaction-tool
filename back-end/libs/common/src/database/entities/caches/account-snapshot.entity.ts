import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

// Append-only changelog of an account's key structure. A new row is written
// only when the key or receiverSignatureRequired changes at transaction terminal
// state; if the state is unchanged from the previous snapshot the existing row
// is reused. This produces a readable timeline of key rotations over time.
//
// createdAt is set explicitly to the transaction's executedAt timestamp (not
// the DB server clock) so that the standard lookup query is correct:
//   SELECT ... WHERE account = ? AND mirrorNetwork = ?
//     AND createdAt <= :executedAt ORDER BY createdAt DESC LIMIT 1
// This returns the exact key structure that was active when any given
// transaction executed, without needing a separate join table.
//
// There is intentionally NO unique constraint on keyHash. This is a changelog,
// not a dedup table — a key rotation A→B→A legitimately produces three rows
// with distinct createdAt values. Dedup-by-hash would collapse the timeline
// and cause the timestamp lookup to return the wrong row for transactions that
// executed while key B was active.
//
// The GIN index on publicKeys enables fast "find all snapshots that include
// public key X" containment lookups for the signer-reporting queries.
// See CachedAccountKey for the B-tree equivalent used on live cache data.
@Entity()
@Index('IDX_account_snapshot_lookup', ['account', 'mirrorNetwork', 'createdAt'])
@Index('IDX_account_snapshot_public_keys_gin', { synchronize: false })
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

  // Set to the triggering transaction's executedAt — not DEFAULT now() — so
  // that timestamp-range lookups land on the correct snapshot row.
  @Column({ type: 'timestamptz' })
  createdAt: Date;
}
