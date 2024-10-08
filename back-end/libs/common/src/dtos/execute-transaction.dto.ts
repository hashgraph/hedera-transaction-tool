import { Network, TransactionStatus } from '@entities';
import { IsEnum, IsNotEmpty, IsNumber } from 'class-validator';
//TODO why did I need to add the /transformers/transformBuffer to get this to work?
import { TransformBuffer } from '@app/common/transformers/transformBuffer';

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
  @IsEnum(Network)
  network: Network;
}