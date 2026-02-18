import { Expose, Type } from 'class-transformer';

import { UserDto } from './user.dto';
import { ClientDto } from './client.dto';

export class UserWithClientsDto extends UserDto {
  @Expose()
  @Type(() => ClientDto)
  clients?: ClientDto[];
}
