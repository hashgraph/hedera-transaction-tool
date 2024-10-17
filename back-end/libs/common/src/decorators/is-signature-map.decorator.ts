import { BadRequestException } from '@nestjs/common';
import { registerDecorator } from 'class-validator';

import { decode, ErrorCodes, isAccountId } from '@app/common';

export function IsSignatureMap() {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSignatureMap',
      target: object.constructor,
      propertyName: propertyName,
      validator: {
        validate(value) {
          if (!value || typeof value !== 'object') throw new BadRequestException(ErrorCodes.ISNMP);

          for (const key in value) {
            if (!isAccountId(key) || !value[key] || typeof value[key] !== 'string')
              throw new BadRequestException(ErrorCodes.ISNMP);

            value[key] = decode(value[key]);
          }
          return true;
        },
      },
    });
  };
}
