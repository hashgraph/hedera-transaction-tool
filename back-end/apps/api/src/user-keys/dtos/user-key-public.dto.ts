import { Expose } from 'class-transformer';

export class UserKeyPublicDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  publicKey: string;

  @Expose()
  deletedAt?: Date;
}
