import { Expose, Transform } from 'class-transformer';

export class TransactionApproverDto {
  @Expose()
  id: number;

  @Expose()
  transactionId: number;

  @Expose()
  listId?: number;

  @Expose()
  threshold?: number;

  @Expose()
  userId?: number;

  @Expose()
  userKeyId?: number;

  @Transform(({ obj }) => (obj.signature ? obj.signature.toString('hex') : undefined))
  @Expose()
  signature?: string;

  @Expose()
  approved?: boolean;

  @Expose()
  createdAt: Date;
}
