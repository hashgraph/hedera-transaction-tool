import { Expose, Transform } from 'class-transformer';

export class TransactionSignerDto {
  @Expose()
  id: number;

  @Transform(({ obj }) => (obj.transaction ? obj.transaction.id : undefined))
  @Expose()
  transactionId: number;

  @Transform(({ obj }) => (obj.userKey ? obj.userKey.id : undefined))
  @Expose()
  userKeyId: number;

  @Transform(({ obj }) =>
    obj.signature ? obj.signature.toString('hex') : undefined,
  )
  @Expose()
  signature: string;

  @Expose()
  createdAt: Date;
}
