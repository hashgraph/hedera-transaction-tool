import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReviewerGroup } from './reviewer-group.entity';
import { EntityRole } from './entity-role.enum';
import { RuleChangeRecord } from './rule-change-record.entity';

// Uniqueness on (hederaEntityId, network, groupId, entityRole, transactionType) is
// enforced by a COALESCE functional unique index in the migration rather than a
// @Unique decorator — TypeORM cannot express functional indexes via decorators, and
// COALESCE is required so that two NULL values are treated as equal (duplicate rules).
//
// Rule updates are not supported until condition evaluation is introduced. Changing
// any structural field (hederaEntityId, entityRole, etc.) is semantically a different
// rule; remove the old one and add a new one. Once conditions land, an update action
// will be added to RuleChangeRecord to handle in-place condition changes.
@Entity()
@Index(['groupId'])
export class ReviewerRule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ReviewerGroup, group => group.rules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: ReviewerGroup;

  @Column()
  groupId: number;

  @Column()
  hederaEntityId: string;

  @Column()
  network: string;

  @Column({ type: String, nullable: true })
  entityRole: EntityRole | null;

  @Column({ type: String, nullable: true })
  transactionType: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;

  @OneToMany(() => RuleChangeRecord, record => record.rule)
  changeRecords: RuleChangeRecord[];
}
