import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn, Index,
} from 'typeorm';
import { CachedNodeAdminKey, TransactionNode } from './';

@Entity()
export class CachedNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  @Index()
  nodeId: number;

  @Column({ length: 100, nullable: true })
  etag?: string; // Mirror node etag or hash of response

  @OneToMany(() => CachedNodeAdminKey, (key) => key.node)
  keys: CachedNodeAdminKey[];

  @OneToMany(() => TransactionNode, (tn) => tn.node)
  nodeTransactions: TransactionNode[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  @Index()
  updatedAt: Date;
}