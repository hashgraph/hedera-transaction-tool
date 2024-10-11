import { IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateTransactionStatusDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
