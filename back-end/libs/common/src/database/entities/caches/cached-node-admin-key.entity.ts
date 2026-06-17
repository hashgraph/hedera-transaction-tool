import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
import { CachedNode } from './';

// Same rationale as CachedAccountKey — normalized rows with B-tree index
// rather than a GIN array because node admin keys are refreshed from mirror
// node and the lower update cost of B-tree outweighs GIN's lookup advantage
// for this frequently-mutated data. See NodeSnapshot for the GIN equivalent.
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