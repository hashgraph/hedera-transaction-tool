import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { TransforToUint8Array } from '@app/common/transformers/transformUint8array';

//TODO approvers and observers can be added to this dto, validatenested,
// also adding cascade to the transaction relations to enable single saves
export class CreateTransactionDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNotEmpty()
  @TransforToUint8Array()
  body: Buffer;

  @IsNumber()
  creatorKeyId: number;

  @IsNotEmpty()
  @TransforToUint8Array()
  signature: Buffer;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  cutoffAt?: Date;
}
