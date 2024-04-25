import { Expose } from 'class-transformer';

export class ServerStatusDto {
  @Expose()
  status: string;
}
