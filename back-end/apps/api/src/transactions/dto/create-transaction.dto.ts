import { TransactionStatus, TransactionType } from '@entities';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsBuffer } from '../../validator/is-buffer.validator';

//TODO approvers and observers can be added to this dto, validatenested,
// also adding cascade to the transaction relations to enable single saves
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
