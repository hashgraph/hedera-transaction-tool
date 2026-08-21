import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class ReviewActionDto {
  @IsBoolean()
  @IsNotEmpty()
  accepted: boolean;

  @ValidateIf(o => o.accepted === false)
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  note?: string;
}
