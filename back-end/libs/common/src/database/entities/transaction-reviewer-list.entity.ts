import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { TransactionReviewerListMember } from './transaction-reviewer-list-member.entity';

@Entity()
@Index(['transactionId'])
export class TransactionReviewerList {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  transactionId: number;

  @Column({ nullable: true })
  name: string | null;

  @Column({ nullable: true })
  description: string | null;

  @Column()
  threshold: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => TransactionReviewerListMember, member => member.list)
  members: TransactionReviewerListMember[];
}
