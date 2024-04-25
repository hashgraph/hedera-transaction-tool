import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { TransformBuffer } from '@app/common';

//TODO approvers and observers can be added to this dto, validatenested,
// also adding cascade to the transaction relations to enable single saves
export class CreateTransactionDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNotEmpty()
  @TransformBuffer()
  body: Buffer;

  @IsNumber()
  creatorKeyId: number;

  @IsNotEmpty()
  @TransformBuffer()
  signature: Buffer;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  cutoffAt?: Date;
}
