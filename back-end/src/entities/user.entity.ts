import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserKey } from './user-key.entity';
import { TransactionComment } from './transaction-comment.entity';
import { TransactionObserver } from './transaction-observer.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: true })
  admin: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @OneToMany(() => UserKey, (userKey) => userKey.user)
  keys: UserKey[];

  @OneToMany(() => TransactionObserver, (observer) => observer.user)
  observableTransactions: TransactionObserver[];

  @OneToMany(() => TransactionComment, (comment) => comment.user)
  comments: TransactionComment[];
}
