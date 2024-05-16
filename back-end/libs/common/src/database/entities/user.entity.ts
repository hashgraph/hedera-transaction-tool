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
import { TransactionSigner } from './transaction-signer.entity';

export enum UserStatus {
  NEW = 'NEW',
  RESET_PASSWORD = 'RESET_PASSWORD',
  NONE = 'NONE',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: false })
  admin: boolean;

  @Column({ default: UserStatus.NEW })
  status: UserStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @OneToMany(() => UserKey, userKey => userKey.user, { eager: true })
  keys: UserKey[];

  @OneToMany(() => TransactionSigner, transactionSigner => transactionSigner.user)
  signerForTransactions: TransactionSigner[];

  @OneToMany(() => TransactionObserver, observer => observer.user)
  observableTransactions: TransactionObserver[];

  @OneToMany(() => TransactionComment, comment => comment.user)
  comments: TransactionComment[];
}
