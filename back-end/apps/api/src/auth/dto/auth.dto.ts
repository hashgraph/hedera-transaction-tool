import { Expose } from 'class-transformer';

export class AuthDto {
  @Expose()
  id: number;

  @Expose()
  email: string;

  @Expose()
  createdAt: Date;
}
