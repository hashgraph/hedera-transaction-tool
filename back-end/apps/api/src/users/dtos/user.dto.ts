import { Expose, Type } from 'class-transformer';
import { IsEnum } from 'class-validator';

import { UserStatus } from '@entities';

import { UserKeyDto } from '../../user-keys/dtos';

export class UserDto {
  @Expose()
  id: number;

  @Expose()
  email: string;

  @Expose()
  admin: boolean;

  @Expose()
  @IsEnum(UserStatus)
  status: UserStatus;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt?: Date;

  @Expose()
  @Type(() => UserKeyDto)
  keys: UserKeyDto[];

  @Expose()
  updateAvailable?: boolean;
}
