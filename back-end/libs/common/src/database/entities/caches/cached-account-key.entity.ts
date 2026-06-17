import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
import { CachedAccount } from './';

// Normalized lookup table for the live account key cache. Storing individual
// public keys as rows (rather than a GIN-indexed array) keeps update cost low:
// when mirror node returns a new key structure, we delete all rows for the
// account and re-insert — simple, localized B-tree operations. GIN indexes
// carry a higher per-update cost because they maintain inverted posting lists,
// which makes them a poor fit for data that refreshes frequently.
// See AccountSnapshot for the GIN-based equivalent used on immutable history.
@Entity()
@Index(['cachedAccountId', 'publicKey'], { unique: true })
export class CachedAccountKey {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CachedAccount, (acc) => acc.keys, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cachedAccountId' })
  cachedAccount: CachedAccount;

  @Column()
  cachedAccountId: number;

  @Column({ length: 128 })
  @Index()
  publicKey: string;
}