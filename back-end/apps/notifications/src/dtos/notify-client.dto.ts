import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class NotifyClientDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @IsOptional()
  @IsNumber()
  groupId?: number;
}