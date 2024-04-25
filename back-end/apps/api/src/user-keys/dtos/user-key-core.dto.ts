import { Expose } from 'class-transformer';

export class UserKeyCoreDto {
  @Expose()
  id: number;

  @Expose()
  mnemonicHash?: string;

  @Expose()
  index?: number;

  @Expose()
  publicKey: string;
}
