import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateTransactionGroupItemDto } from './create-transaction-group-item.dto';
import { Type } from 'class-transformer';
import { MAX_TRANSACTION_GROUP_DESCRIPTION_LENGTH } from '@entities';

export class CreateTransactionGroupDto {
  @IsString()
  @MaxLength(MAX_TRANSACTION_GROUP_DESCRIPTION_LENGTH)
  description: string;

  @IsOptional()
  @IsBoolean()
  atomic: boolean;

  @IsOptional()
  @IsBoolean()
  sequential: boolean;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionGroupItemDto)
  groupItems: CreateTransactionGroupItemDto[];
}
