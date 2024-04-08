import { IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsBoolean()
  admin: boolean;
}
