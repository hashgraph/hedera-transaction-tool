import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isDefined, isEnum } from 'class-validator';

@Injectable()
export class EnumArrayValidationPipe<T> implements PipeTransform<string, T[]> {
  constructor(private enumEntity: object) {}

  transform(value: string): T[] {
    if (!isDefined(value) || value.trim() === '') {
      return null;
    }

    const result = new Set<T>();
    const items = value.split(',');

    for (const item of items) {
      if (isEnum(item, this.enumEntity)) {
        result.add(item as T);
      } else {
        throw new BadRequestException(
          `The value "${item}" is not valid. Acceptable values: ${Object.values(this.enumEntity).join(', ')}`
        );
      }
    }

    return result.size > 0 ? Array.from(result).sort() : null;
  }
}
