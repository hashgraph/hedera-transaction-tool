import { Expose, Type } from 'class-transformer';

import { UserKeyPublicDto } from '../../user-keys/dtos';
import { ApiKeyStatusDto } from '../../api-keys/dtos';

import { UserDto } from './user.dto';
import { ClientDto } from './client.dto';

export class UserWithClientsDto extends UserDto {
  @Expose()
  @Type(() => ClientDto)
  clients?: ClientDto[];

  @Expose()
  @Type(() => UserKeyPublicDto)
  override keys!: UserKeyPublicDto[];

  // Only populated for admin requesters (see UsersService) - lets admins see
  // whether another user has a report API key and how it's being used,
  // without exposing the key itself.
  @Expose()
  @Type(() => ApiKeyStatusDto)
  apiKeyStatus?: ApiKeyStatusDto;
}
