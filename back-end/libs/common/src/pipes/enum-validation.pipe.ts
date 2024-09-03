import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isDefined, isEnum } from 'class-validator';

@Injectable()
export class EnumValidationPipe<T> implements PipeTransform<string, Promise<T>> {
  constructor(
    private enumEntity,
    private optional = false,
  ) {}

  transform(value: string): Promise<T> {
    if (this.optional && !isDefined(value)) {
      return Promise.resolve(undefined);
    }

    if (isDefined(value) && isEnum(value, this.enumEntity)) {
      return this.enumEntity[value];
    } else {
      const errorMessage = `the value ${value} is not valid. See the acceptable values: ${Object.keys(this.enumEntity).map(key => this.enumEntity[key])}`;
      throw new BadRequestException(errorMessage);
    }
  }
}
