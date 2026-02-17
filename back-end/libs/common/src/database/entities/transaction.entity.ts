import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
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
  TransactionCachedAccount,
  TransactionCachedNode,
} from './';

import { ApiProperty } from '@nestjs/swagger';

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
  NODE_CREATE = 'NODE CREATE',
  NODE_UPDATE = 'NODE UPDATE',
  NODE_DELETE = 'NODE DELETE',
}

export enum TransactionStatus {
  NEW = 'NEW', // unused
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
  WAITING_FOR_SIGNATURES = 'WAITING FOR SIGNATURES',
  WAITING_FOR_EXECUTION = 'WAITING FOR EXECUTION',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
}

export const MAX_TRANSACTION_BYTE_SIZE = 6_144;

@Entity()
@Index(['status', 'mirrorNetwork'])
@Index(['creatorKeyId'])
@Index('idx_transaction_public_keys_gin', {
  // Tell TypeORM this index exists but is managed by migrations
  synchronize: false,
})
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  name: string;

  @Column()
  type: TransactionType;

  @Column({ length: 256 })
  description: string;

  @Column()
  transactionId: string;

  @Column()
  transactionHash: string;

  @ApiProperty({
    description: 'The transaction in bytes',
  })
  @Column({ type: 'bytea' })
  transactionBytes: Buffer;

  @ApiProperty({
    description: 'The transaction in bytes. This transaction does not contain any signatures.',
  })
  @Column({ type: 'bytea' })
  unsignedTransactionBytes: Buffer;

  @Column()
  status: TransactionStatus;

  @Column({ nullable: true })
  statusCode?: number;

  @ApiProperty({
    description: 'The id of the user key used by the creator',
  })
  @ManyToOne(() => UserKey, userKey => userKey.createdTransactions)
  @JoinColumn({ name: 'creatorKeyId' })
  creatorKey: UserKey;

  @Column()
  creatorKeyId: number;

  @Column({ type: 'bytea' })
  signature: Buffer;

  @Column()
  validStart: Date;

  @Column()
  mirrorNetwork: string;

  @Column({ default: false })
  isManual: boolean;

  @Column({ nullable: true })
  cutoffAt?: Date;

  /**
   * List of keys from the newKey, where applicable.
   */
  @Column({ type: 'text', array: true, nullable: true })
  publicKeys: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  executedAt?: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @OneToMany(() => TransactionComment, comment => comment.transaction)
  comments?: TransactionComment[];

  @OneToMany(() => TransactionSigner, signer => signer.transaction)
  signers?: TransactionSigner[];

  @OneToMany(() => TransactionApprover, approver => approver.transaction)
  approvers?: TransactionApprover[];

  @OneToMany(() => TransactionObserver, observer => observer.transaction)
  observers?: TransactionObserver[];

  @OneToOne(() => TransactionGroupItem, groupItem => groupItem.transaction)
  groupItem?: TransactionGroupItem;

  @OneToMany(() => TransactionCachedAccount, (ta) => ta.transaction)
  transactionCachedAccounts: TransactionCachedAccount[];

  @OneToMany(() => TransactionCachedNode, (ta) => ta.transaction)
  transactionCachedNodes: TransactionCachedNode[];
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
  'mirrorNetwork',
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
