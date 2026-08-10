import { Expose, Type } from 'class-transformer';

import { UserKeyPublicDto } from '../../user-keys/dtos';

import { UserDto } from './user.dto';
import { ClientDto } from './client.dto';

export class UserWithClientsDto extends UserDto {
  @Expose()
  @Type(() => ClientDto)
  clients?: ClientDto[];

  @Expose()
  @Type(() => UserKeyPublicDto)
  keys: UserKeyPublicDto[];
}
