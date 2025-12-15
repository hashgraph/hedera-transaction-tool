import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { CachedNode } from './';

@Entity()
export class CachedNodeAdminKey {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CachedNode, (node) => node.keys, {
    onDelete: 'CASCADE',
  })
  @Index()
  node: CachedNode;

  @Column({ length: 128 })
  @Index()
  publicKey: string;
}