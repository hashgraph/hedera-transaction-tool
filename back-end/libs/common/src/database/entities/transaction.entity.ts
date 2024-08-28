import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  UserKey,
  TransactionComment,
  TransactionSigner,
  TransactionApprover,
  TransactionObserver,
  TransactionGroupItem,
} from './';

import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

export enum Network {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  PREVIEWNET = 'previewnet',
  LOCAL_NODE = 'local-node',
}

export enum TransactionType {
  ACCOUNT_CREATE = 'ACCOUNT CREATE',
  ACCOUNT_UPDATE = 'ACCOUNT UPDATE',
  ACCOUNT_DELETE = 'ACCOUNT DELETE',
  ACCOUNT_ALLOWANCE_APPROVE = 'ACCOUNT ALLOWANCE APPROVE',
  FILE_CREATE = 'FILE CREATE',
  FILE_APPEND = 'FILE APPEND',
  FILE_UPDATE = 'FILE UPDATE',
  FILE_DELETE = 'FILE DELETE',
  FREEZE = 'FREEZE',
  SYSTEM_DELETE = 'SYSTEM DELETE',
  SYSTEM_UNDELETE = 'SYSTEM UNDELETE',
  TRANSFER = 'TRANSFER',
}

export enum TransactionStatus {
  NEW = 'NEW', // unused
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED', // unused
  WAITING_FOR_SIGNATURES = 'WAITING FOR SIGNATURES',
  WAITING_FOR_EXECUTION = 'WAITING FOR EXECUTION',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  name: string;

  @Column()
  type: TransactionType;

  @Column({ length: 256 })
  description: string;

  @Column({ unique: true })
  transactionId: string;

  @Column()
  transactionHash: string;

  @ApiProperty({
    description: 'The transaction in bytes',
  })
  @Column({ type: 'bytea' })
  transactionBytes: Buffer;

  @ApiProperty({
    description: 'The transaction in bytes. This tranaction does not contain any signatures.',
  })
  @Column({ type: 'bytea'})
  unsignedTransactionBytes: Buffer;

  @Column()
  status: TransactionStatus;

  @Column({ nullable: true })
  statusCode?: number;

  @ApiProperty({
    description: 'The id of the user key used by the creator',
  })
  @ManyToOne(() => UserKey, userKey => userKey.createdTransactions)
  creatorKey: UserKey;

  @Column({ type: 'bytea' })
  signature: Buffer;

  @Column()
  validStart: Date;

  @Column()
  network: Network;

  @Column({ nullable: true })
  cutoffAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  executedAt?: Date;

  @ApiHideProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @OneToMany(() => TransactionComment, comment => comment.transaction)
  comments: TransactionComment[];

  @OneToMany(() => TransactionSigner, signer => signer.transaction)
  signers: TransactionSigner[];

  @OneToMany(() => TransactionApprover, approver => approver.transaction)
  approvers: TransactionApprover[];

  @OneToMany(() => TransactionObserver, observer => observer.transaction)
  observers: TransactionObserver[];

  @OneToOne(() => TransactionGroupItem, groupItem => groupItem.transaction)
  groupItem?: TransactionGroupItem;
}

export const transactionProperties: (keyof Transaction)[] = [
  'id',
  'name',
  'type',
  'description',
  'transactionId',
  'validStart',
  'transactionHash',
  'status',
  'statusCode',
  'network',
  'createdAt',
  'executedAt',
  'updatedAt',
  'deletedAt',
];

export const transactionDateProperties: (keyof Transaction)[] = [
  'createdAt',
  'deletedAt',
  'updatedAt',
  'executedAt',
  'deletedAt',
  'validStart',
];
