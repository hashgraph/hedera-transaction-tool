import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class ReviewSignatureDto {
  @IsInt()
  @IsNotEmpty()
  userKeyId!: number;

  @IsString()
  @IsNotEmpty()
  signature!: string;
}
