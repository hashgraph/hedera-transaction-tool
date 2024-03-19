import { Status, TransactionType } from '../../entities/transaction.entity';
import { Expose, Transform } from 'class-transformer';

export class TransactionDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  type: TransactionType;

  @Expose()
  description: string;

  @Transform(({ obj }) => obj.body.toString('hex'))
  @Expose()
  body: Buffer;

  @Expose()
  status: Status;

  @Expose()
  responseCode?: string;

  @Transform(({ obj }) => obj.signature.toString('hex'))
  @Expose()
  signature: Buffer;

  @Expose()
  validStart: Date;

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
}
