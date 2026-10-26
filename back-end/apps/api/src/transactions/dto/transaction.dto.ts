import { Expose, Transform, Type } from 'class-transformer';

import { TransactionStatus, TransactionType } from '@entities';

import { TransactionSignerUserKeyDto } from './transaction-signer.dto';
import { TransactionObserverDto } from './transaction-observer.dto';
import { TransactionGroupItemDto } from './transaction-group-item.dto';

export class TransactionReviewerListMemberDto {
  @Expose()
  userId!: number;

  @Expose()
  accepted!: boolean | null;

  @Expose()
  note!: string | null;

  @Expose()
  actionedAt!: Date | null;
}

export class TransactionReviewerListDto {
  @Expose()
  id!: number;

  @Expose()
  name!: string | null;

  @Expose()
  description!: string | null;

  @Expose()
  threshold!: number;

  @Expose()
  @Type(() => TransactionReviewerListMemberDto)
  members!: TransactionReviewerListMemberDto[];
}

export class TransactionDto {
  @Expose()
  id!: number;

  @Expose()
  name!: string;

  @Expose()
  type!: TransactionType;

  @Expose()
  transactionId!: string;

  @Expose()
  description!: string;

  @Transform(({ obj }) => obj.transactionBytes.toString('hex'))
  @Expose()
  transactionBytes!: Buffer;

  /**
   * The transaction bytes as created, before anyone added signatures. These are the bytes the
   * creator `signature` is made over.
   */
  @Transform(({ obj }) => obj.unsignedTransactionBytes?.toString('hex'))
  @Expose()
  unsignedTransactionBytes!: Buffer;

  @Expose()
  status!: TransactionStatus;

  @Expose()
  statusCode?: number;

  @Transform(({ obj }) => obj.signature.toString('hex'))
  @Expose()
  signature!: Buffer;

  @Expose()
  validStart!: Date;

  @Expose()
  isManual!: boolean;

  @Expose()
  cutoffAt?: Date;

  @Expose()
  createdAt!: Date;

  @Expose()
  executedAt?: Date;

  @Expose()
  updatedAt!: Date;

  @Transform(({ obj }) => (obj.creatorKey ? obj.creatorKey.id : undefined))
  @Expose()
  creatorKeyId!: number;

  @Transform(({ obj }) => obj.creatorKey?.user?.id)
  @Expose()
  creatorId!: number;

  @Transform(({ obj }) => obj.creatorKey?.user?.email)
  @Expose()
  creatorEmail!: string;

  @Expose()
  @Type(() => TransactionGroupItemDto)
  groupItem?: TransactionGroupItemDto;

  @Expose()
  hasRejection?: boolean;
}

export class TransactionFullDto extends TransactionDto {
  // @Expose()
  // @Type(() => TransactionCommentDto)
  // comments: TransactionCommentDto[];

  @Expose()
  @Type(() => TransactionSignerUserKeyDto)
  signers!: TransactionSignerUserKeyDto[];

  @Expose()
  @Type(() => TransactionObserverDto)
  observers!: TransactionObserverDto[];

  @Expose()
  @Type(() => TransactionReviewerListDto)
  reviewerLists?: TransactionReviewerListDto[];
}
