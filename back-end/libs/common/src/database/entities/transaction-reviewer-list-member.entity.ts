import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TransactionReviewerList } from './transaction-reviewer-list.entity';
import { User } from './user.entity';
import { UserKey } from './user-key.entity';

@Entity()
@Index(['listId', 'userId'], { unique: true })
@Index(['userId'])
export class TransactionReviewerListMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TransactionReviewerList, list => list.members)
  @JoinColumn({ name: 'listId' })
  list: TransactionReviewerList;

  @Column()
  listId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => UserKey, { nullable: true })
  @JoinColumn({ name: 'userKeyId' })
  userKey: UserKey | null;

  @Column({ nullable: true })
  userKeyId: number | null;

  @Column({ type: 'bytea', nullable: true })
  signature: Buffer | null;

  @Column({ type: Boolean, nullable: true })
  accepted: boolean | null;

  @Column({ type: String, nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  actionedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
