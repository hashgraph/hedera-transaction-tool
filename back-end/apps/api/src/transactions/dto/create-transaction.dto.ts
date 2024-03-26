import { TransactionStatus, TransactionType } from '@entities/transaction.entity';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsBuffer } from '../../validator/is-buffer.validator';

export class CreateTransactionDto {
  @IsString()
  name: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsString()
  description: string;

  @IsBuffer()
  body: Buffer;

  @IsEnum(TransactionStatus)
  status: TransactionStatus;
  // responseCode: string;

  @IsNumber()
  creatorKeyId: number;

  @IsBuffer()
  signature: Buffer;

  @Type(() => Date)
  @IsDate()
  validStart: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  cutoffAt?: Date;
}
