import { IsEnum, IsNumber } from 'class-validator';
import { Role } from '@entities';

export class CreateTransactionObserverDto {
  @IsNumber()
  userId: number;

  @IsEnum(Role)
  role: Role;
}
