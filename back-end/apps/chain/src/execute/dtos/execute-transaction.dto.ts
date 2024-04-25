import { IsNotEmpty, IsNumber } from 'class-validator';

export class ExecuteTransactionDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
