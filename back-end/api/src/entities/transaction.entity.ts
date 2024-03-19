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

  // These three columns are strictly for increasing the search speed.
  // If the body can be stored in json format and be fast and searchable,
  // these columns should not be needed.
  // The issue: as the transaction body is stored in bytes, it is not searchable.
  // This means that when a user logs in, there is no easy and direct way to use
  // their keys and find transactions they need to sign. In addition, the keys in
  // the transaction may not be up-to-date. So, the keys and accounts that will be
  // stored in these searchable fields will be non-changeable. The keys that are
  // part of the accounts will be requested from mirror node when needed.

  //TODO when using postgres, this may be the data structure to use
  //@Column('string', { array: true, default: {} })
  // then search it like this
  //this.getFindQueryBuilder().where("recipe.tags && ARRAY[:...tags]", {tags: tags})
  //or maybe
  //createQueryBuilder().where('newKeys @> ARRAY[:...newKeys], { newKeys })
  //or even maybe (not sure if this becomes an AND or OR, likely AND, but I want OR)
  //findBy({ names: ArrayContains([name1,name2]) })

  // The list of any keys that are new to the account/file
  @Column('simple-array', { select: false })
  newKeys: string[];

  // The list of accounts that will receive funds
  @Column('simple-array', { select: false })
  receiverAccounts: string[];

  // The list of accounts that are otherwise involved (and NOT receiver accounts)
  @Column('simple-array', { select: false })
  accounts: string[];
}
