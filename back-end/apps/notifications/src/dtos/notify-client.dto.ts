import { IsNotEmpty, IsNumber } from 'class-validator';

export class NotifyClientDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;
}