import { IsEnum } from 'class-validator';
import { Role } from '@entities';

export class UpdateTransactionObserverDto {
  @IsEnum(Role)
  role: Role;
}
