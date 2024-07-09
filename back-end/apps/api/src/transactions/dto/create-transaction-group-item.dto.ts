import { IsNotEmptyObject, IsNumber, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTransactionDto } from './create-transaction.dto';

export class CreateTransactionGroupItemDto {
  @IsNumber()
  seq: number;

  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDto)
  transaction: CreateTransactionDto;
}
