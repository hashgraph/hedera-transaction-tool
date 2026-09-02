import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReviewerGroupMember } from './reviewer-group-member.entity';
import { ReviewerRule } from './reviewer-rule.entity';
import { GroupChangeRecord } from './group-change-record.entity';

@Entity()
export class ReviewerGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: String, nullable: true })
  description: string | null;

  @Column()
  threshold: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;

  @OneToMany(() => ReviewerGroupMember, member => member.group)
  members: ReviewerGroupMember[];

  @OneToMany(() => ReviewerRule, rule => rule.group)
  rules: ReviewerRule[];

  @OneToMany(() => GroupChangeRecord, record => record.group)
  changeRecords: GroupChangeRecord[];
}
