import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateTransactionApproverDto {
  @IsNumber()
  @IsOptional()
  listId?: number|null;

  @IsNumber()
  @Min(1)
  @IsOptional()
  threshold?: number;

  @IsNumber()
  @IsOptional()
  userId?: number;
}
