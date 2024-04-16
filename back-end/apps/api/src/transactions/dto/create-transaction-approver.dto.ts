import { IsBoolean, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { TransformBuffer } from '@app/common';

export class CreateTransactionApproverDto {
  @IsNumber()
  @IsOptional()
  transactionId?: number;

  @IsNumber()
  @IsOptional()
  listId?: number;

  @IsNumber()
  @IsOptional()
  threshold?: number;

  @IsNumber()
  @IsOptional()
  userKeyId?: number;

  @IsNotEmpty()
  @TransformBuffer()
  signature?: Buffer;

  @IsBoolean()
  @IsOptional()
  approved?: boolean;
}
