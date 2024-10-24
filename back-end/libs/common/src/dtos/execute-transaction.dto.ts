import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

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

  @IsNotEmpty()
  @IsString()
  mirrorNetworkRest: string;
}
