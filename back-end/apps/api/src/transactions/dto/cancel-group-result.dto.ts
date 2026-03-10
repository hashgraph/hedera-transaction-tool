import { Expose, Type } from 'class-transformer';

class CancelGroupFailedItemDto {
  @Expose()
  id: number;

  @Expose()
  reason: string;
}

export class CancelGroupResultDto {
  @Expose()
  canceled: number[];

  @Expose()
  alreadyCanceled: number[];

  @Expose()
  @Type(() => CancelGroupFailedItemDto)
  failed: CancelGroupFailedItemDto[];
}
