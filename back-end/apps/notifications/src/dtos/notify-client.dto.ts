import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class NotifyClientDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  transactionIds?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  groupIds?: number[];

  @IsOptional()
  @IsString()
  eventType?: string;
}
