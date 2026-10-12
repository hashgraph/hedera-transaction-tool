import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsBoolean()
  admin?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewReports?: boolean;
}
