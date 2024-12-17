import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';

@Entity()
export class TransactionComment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction, transaction => transaction.comments)
  transaction: Transaction;

  @ManyToOne(() => User, user => user.comments)
  user: User;

  @Column()
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}
