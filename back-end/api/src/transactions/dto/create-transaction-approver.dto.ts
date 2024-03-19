import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { IsBuffer } from '../../validator/is-buffer.validator';

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

  @IsBuffer(false)
  signature?: Buffer;

  @IsBoolean()
  @IsOptional()
  approved?: boolean;
}
