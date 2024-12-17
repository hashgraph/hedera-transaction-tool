import { IsArray, IsBoolean, IsNotEmpty, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ExecuteTransactionDto } from './execute-transaction.dto';

export class ExecuteTransactionGroupDto {
  @IsNumber()
  id: number;

  @IsBoolean()
  sequential: boolean;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecuteTransactionGroupItemDto)
  groupItems: ExecuteTransactionGroupItemDto[];
}

export class ExecuteTransactionGroupItemDto {
  @IsNumber()
  seq: number;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ExecuteTransactionDto)
  transaction: ExecuteTransactionDto;
}
