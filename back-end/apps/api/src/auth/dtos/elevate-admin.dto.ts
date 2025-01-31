import { IsNotEmpty, IsNumber } from 'class-validator';

export class ElevateAdminDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
