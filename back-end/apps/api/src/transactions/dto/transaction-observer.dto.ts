import { Expose } from 'class-transformer';
import { Role } from '@entities';

export class TransactionObserverDto {
  @Expose()
  id: number;

  @Expose()
  transactionId: number;

  @Expose()
  userId: number;

  @Expose()
  role: Role;

  @Expose()
  createdAt: Date;
}
