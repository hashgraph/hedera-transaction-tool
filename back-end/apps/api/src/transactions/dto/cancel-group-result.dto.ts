import { Expose, Type } from 'class-transformer';

export enum CancelFailureCode {
  NOT_CANCELABLE = 'NOT_CANCELABLE',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

class CancelGroupFailedItemDto {
  @Expose()
  id: number;

  @Expose()
  code: CancelFailureCode;

  @Expose()
  message: string;
}

class CancelGroupSummaryDto {
  @Expose()
  processedCount: number;

  @Expose()
  canceled: number;

  @Expose()
  alreadyCanceled: number;

  @Expose()
  failed: number;
}

export class CancelGroupResultDto {
  @Expose()
  canceled: number[];

  @Expose()
  alreadyCanceled: number[];

  @Expose()
  @Type(() => CancelGroupFailedItemDto)
  failed: CancelGroupFailedItemDto[];

  @Expose()
  @Type(() => CancelGroupSummaryDto)
  summary: CancelGroupSummaryDto;
}
