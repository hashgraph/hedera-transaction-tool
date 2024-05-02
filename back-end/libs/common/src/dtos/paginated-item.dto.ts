import { Expose } from 'class-transformer';

export class PaginatedResourceDto<T> {
  @Expose()
  totalItems: number;

  @Expose()
  items: T[];

  @Expose()
  page: number;

  @Expose()
  size: number;
}
