import { Expose, Transform, Type } from 'class-transformer';

import { TransactionStatus, TransactionType } from '@entities';

import { TransactionSignerUserKeyDto } from './transaction-signer.dto';
import { TransactionApproverDto } from './transaction-approver.dto';
import { TransactionObserverDto } from './transaction-observer.dto';
import { TransactionGroupItemDto } from './transaction-group-item.dto';

export class TransactionDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  type: TransactionType;

  @Expose()
  transactionId: string;

  @Expose()
  description: string;

  @Transform(({ obj }) => obj.transactionBytes.toString('hex'))
  @Expose()
  transactionBytes: Buffer;

  @Expose()
  status: TransactionStatus;

  @Expose()
  statusCode?: number;

  @Transform(({ obj }) => obj.signature.toString('hex'))
  @Expose()
  signature: Buffer;

  @Expose()
  validStart: Date;

  @Expose()
  isManual: boolean;

  @Expose()
  cutoffAt?: Date;

  @Expose()
  createdAt: Date;

  @Expose()
  executedAt?: Date;

  @Expose()
  updatedAt: Date;

  @Transform(({ obj }) => (obj.creatorKey ? obj.creatorKey.id : undefined))
  @Expose()
  creatorKeyId: number;

  @Transform(({ obj }) => obj.creatorKey?.user?.id)
  @Expose()
  creatorId: number;

  @Transform(({ obj }) => obj.creatorKey?.user?.email)
  @Expose()
  creatorEmail: string;

  @Expose()
  @Type(() => TransactionGroupItemDto)
  groupItem?: TransactionGroupItemDto;
}

export class TransactionFullDto extends TransactionDto {
  // @Expose()
  // @Type(() => TransactionCommentDto)
  // comments: TransactionCommentDto[];

  @Expose()
  @Type(() => TransactionSignerUserKeyDto)
  signers: TransactionSignerUserKeyDto[];

  @Expose()
  @Type(() => TransactionApproverDto)
  approvers: TransactionApproverDto[];

  @Expose()
  @Type(() => TransactionObserverDto)
  observers: TransactionObserverDto[];
}
