import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
import { CachedNode } from './';

@Entity()
@Index(['cachedNodeId', 'publicKey'], { unique: true })
export class CachedNodeAdminKey {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CachedNode, (node) => node.keys, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cachedNodeId' })
  cachedNode: CachedNode;

  @Column()
  cachedNodeId: number;

  @Column({ length: 128 })
  @Index()
  publicKey: string;
}