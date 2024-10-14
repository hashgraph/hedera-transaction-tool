import { Expose } from 'class-transformer';

export class UserKeyDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  mnemonicHash?: string;

  @Expose()
  index?: number;

  @Expose()
  publicKey: string;

  @Expose()
  deletedAt?: Date;
}
