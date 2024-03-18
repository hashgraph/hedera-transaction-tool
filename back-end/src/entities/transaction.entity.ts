import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserKey } from './user-key.entity';
import { TransactionComment } from './transaction-comment.entity';
import { TransactionSigner } from './transaction-signer.entity';
import { TransactionApprover } from './transaction-approver.entity';
import { TransactionObserver } from './transaction-observer.entity';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

export enum TransactionType {
  ACCOUNT_CREATE = 'ACCOUNT CREATE',
  ACCOUNT_UPDATE = 'ACCOUNT UPDATE',
  FILE_APPEND = 'FILE APPEND',
  FILE_UPDATE = 'FILE UPDATE',
  FREEZE = 'FREEZE',
  SYSTEM_DELETE = 'SYSTEM DELETE',
  TRANSFER = 'TRANSFER',
}

export enum Status {
  NEW = 'NEW',
  REJECTED = 'REJECTED',
  WAITING_FOR_SIGNATURES = 'WAITING FOR SIGNATURES',
  WAITING_FOR_EXECUTION = 'WAITING FOR EXECUTION',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
}

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  type: TransactionType;

  @Column()
  description: string;

  @Column()
  body: Buffer;

  @Column({ nullable: true })
  collatedBody?: Buffer;

  @Column()
  status: Status;

  //TODO This might be a string? It is an enum, so not sure how it will come back
  @Column({ nullable: true })
  responseCode?: string;

  @ApiProperty({
    description: "The id of the user key used by the creator",
  })
  @ManyToOne(() => UserKey, (userKey) => userKey.createdTransactions)
  creatorKey: UserKey;

  @Column()
  signature: Buffer;

  @Column()
  validStart: Date;

  @Column({ nullable: true })
  cutoffAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  executedAt?: Date;

  @ApiHideProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => TransactionComment, (comment) => comment.transaction)
  comments: TransactionComment[];

  @OneToMany(() => TransactionSigner, (signer) => signer.transaction)
  signers: TransactionSigner[];

  @OneToMany(() => TransactionApprover, (approver) => approver.transaction)
  approvers: TransactionApprover[];

  @OneToMany(() => TransactionObserver, (observer) => observer.transaction)
  observers: TransactionObserver[];

  //TODO column with the accounts needed for signing, but does not include
  // accounts that require sig for receiving. Well, unless that account is part of this org.
  // If the account is part of this org, and the sig required flag is turned on/off, then
  // this would need to be updated
  // THE FLOW: user signs in, server gets all keys for the user, requests all accounts associated with those keys
  // from mirror node, using those accounts pulls all transactions that require those accounts
  // this column would only ever be wrong if that receiver was part of the org (therefore notifications are required)
  // and the receiver flipped the flag
  // so, then how about all 'interested' accounts are in this list, and not just for required sigs

  // Do not include in select, nor any dto
  // This column is only used for searching.
  // When a transaction is created or updated, the
  // accounts (or keys in the case of a transaction like AccountUpdate)
  // will be gathered and turned into a csv and stored here.
  // This allows for quick searching of transactions by account/key.
  // When a user requests transactions to sign, each key the user
  // owns will be used to get associated accounts, which will then be used
  // to search transactions for those transactions the user needs to sign.

  // ***i might want to prefix accounts with a 'R:' or something to indicate which are receivers, then the search can include/exlude the "R:" as needed
  // or I would need to save receiver accounts separately
  @Column({select: false})
  accountsOrKeys: string;
}
