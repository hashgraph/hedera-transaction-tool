import { IsDate, IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';

import { TransformBuffer } from '@app/common/transformers';
import { TransactionStatus } from '@entities';

export class ExecuteTransactionDto {
  @IsNumber()
  id: number;

  @IsNotEmpty()
  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @IsNotEmpty()
  @TransformBuffer()
  transactionBytes: Buffer;

  @IsNotEmpty()
  @IsString()
  mirrorNetwork: string;

  @IsOptional()
  @IsDate()
  validStart?: Date;
}
