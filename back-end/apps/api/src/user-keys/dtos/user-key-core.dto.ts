import { Expose } from 'class-transformer';

export class UserKeyCoreDto {
  @Expose()
  id: number;

  @Expose()
  publicKey: string;
}
