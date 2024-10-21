import { Expose, Type } from 'class-transformer';

import { UserDto } from '../../users/dtos';

export class LoginResponseDto {
  @Expose()
  @Type(() => UserDto)
  user: UserDto;

  @Expose()
  accessToken: string;
}
