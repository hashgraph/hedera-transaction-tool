import { IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateUserKeyMnemonicHashDto {
  @IsString()
  @IsNotEmpty()
  mnemonicHash: string;

  @IsOptional()
  @IsNumber()
  index?: number;
}
