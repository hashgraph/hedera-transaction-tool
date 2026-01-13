import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { CachedAccount } from './';

@Entity()
@Index(['account', 'publicKey'], { unique: true })
export class CachedAccountKey {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CachedAccount, (acc) => acc.keys, {
    onDelete: 'CASCADE',
  })
  @Index()
  account: CachedAccount;

  @Column({ length: 128 })
  @Index()
  publicKey: string;
}