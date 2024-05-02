import { mixin } from '@nestjs/common';

import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

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

type Constructor<T = object> = new (...args) => T;

export function withPaginatedResponse<TBase extends Constructor>(Base: TBase) {
  class ResponseDTO {
    @Expose()
    totalItems: number;

    @Expose()
    page: number;

    @Expose()
    size: number;

    @Expose()
    @Type(() => Base)
    @ValidateNested({ each: true })
    items: Array<InstanceType<TBase>>;
  }
  return mixin(ResponseDTO);
}
