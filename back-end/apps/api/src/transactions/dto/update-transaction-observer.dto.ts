import { IsEnum } from 'class-validator';
import { Role } from '@entities/transaction-observer.entity';

export class UpdateTransactionObserverDto {
  @IsEnum(Role)
  role: Role;
}
