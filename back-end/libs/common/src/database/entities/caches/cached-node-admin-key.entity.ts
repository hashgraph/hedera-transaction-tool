import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { CachedNode } from './';

@Entity()
@Index(['node', 'publicKey'], { unique: true })
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