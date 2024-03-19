import { Expose, Transform } from 'class-transformer';

export class UserKeyDto {
  @Expose()
  id: number;

  @Transform(({ obj }) => obj.user.id)
  @Expose()
  userId: number;

  @Expose()
  publicKey: string;

  @Expose()
  deletedAt?: Date;
}
