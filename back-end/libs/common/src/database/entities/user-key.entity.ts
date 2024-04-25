import {
  Column,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Transaction } from './transaction.entity';
import { TransactionSigner } from './transaction-signer.entity';
import { TransactionApprover } from './transaction-approver.entity';

@Entity()
export class UserKey {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, user => user.keys)
  user: User;

  @Column({ nullable: true })
  mnemonicHash: string;

  @Column({ nullable: true })
  index: number;

  @Column()
  publicKey: string;

  @DeleteDateColumn()
  deletedAt: Date;

  @OneToMany(() => Transaction, transaction => transaction.creatorKey)
  createdTransactions: Transaction[];

  @OneToMany(() => TransactionApprover, approver => approver.userKey)
  approvedTransactions: TransactionApprover[];

  @OneToMany(() => TransactionSigner, signer => signer.userKey)
  signedTransactions: TransactionSigner[];
}
