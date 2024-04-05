import { Expose, Transform } from 'class-transformer';
import { Role } from '@entities';

export class TransactionObserverDto {
  @Expose()
  id: number;

  @Transform(({ obj }) => (obj.transaction ? obj.transaction.id : undefined))
  @Expose()
  transactionId: number;

  @Transform(({ obj }) => (obj.user ? obj.user.id : undefined))
  @Expose()
  userId: number;

  @Expose()
  role: Role;

  @Expose()
  createdAt: Date;
}
