import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
import { CachedAccount } from './';

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