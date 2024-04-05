import { Expose } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { UserStatus } from '@entities';

export class UserDto {
  @Expose()
  id: number;

  @Expose()
  email: string;

  @Expose()
  admin: boolean;

  @IsEnum(UserStatus)
  status: UserStatus;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt?: Date;
}
