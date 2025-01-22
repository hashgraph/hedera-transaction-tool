import { IsNotEmpty, IsNumber } from 'class-validator';

export class NotifyForTransactionDto {
  @IsNumber()
  @IsNotEmpty()
  transactionId: number;

  @IsNotEmpty()
  network: string;
}
