import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReviewerGroup } from './reviewer-group.entity';
import { User } from './user.entity';
import { UserKey } from './user-key.entity';

@Entity()
@Index(['groupId', 'userId'], { unique: true })
@Index(['userId'])
export class ReviewerGroupMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ReviewerGroup, group => group.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: ReviewerGroup;

  @Column()
  groupId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => UserKey)
  @JoinColumn({ name: 'userKeyId' })
  userKey: UserKey;

  @Column()
  userKeyId: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date;
}
