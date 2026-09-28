import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isDefined, isEnum } from 'class-validator';

type EnumEntity = Record<string, string | number>;

@Injectable()
export class EnumValidationPipe<T extends string | number> implements PipeTransform<
  string,
  Promise<T | undefined>
> {
  constructor(
    private enumEntity: EnumEntity,
    private optional = false,
  ) {}

  async transform(value: string): Promise<T | undefined> {
    if (this.optional && !isDefined(value)) {
      return Promise.resolve(undefined);
    }

    if (isDefined(value) && isEnum(value, this.enumEntity)) {
      return this.enumEntity[value] as T;
    } else {
      const errorMessage = `the value ${value} is not valid. See the acceptable values: ${Object.keys(this.enumEntity).map(key => this.enumEntity[key])}`;
      throw new BadRequestException(errorMessage);
    }
  }
}
