import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isDefined, isEnum } from 'class-validator';

@Injectable()
export class EnumArrayValidationPipe<T> implements PipeTransform<string, T[]> {
  constructor(private enumEntity: object) {}

  transform(value: string): T[] {
    const result = new Set<T>();
    if (isDefined(value) && value !== '') {
      const items = value.split(',');
      for (const item of items) {
        if (isEnum(item, this.enumEntity)) {
          result.add(item as T);
        } else {
          const errorMessage = `the value ${value} is not valid. See the acceptable values: ${Object.keys(this.enumEntity).map(key => this.enumEntity[key])}`;
          throw new BadRequestException(errorMessage);
        }
      }
    } // else keeps result empty
    return Array.from(result.values()).sort();
  }
}
