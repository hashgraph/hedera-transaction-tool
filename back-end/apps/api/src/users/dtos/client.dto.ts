import { Expose } from 'class-transformer';

export class ClientDto {
  @Expose()
  id: number;

  @Expose()
  version: string;

  @Expose()
  updateAvailable: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
