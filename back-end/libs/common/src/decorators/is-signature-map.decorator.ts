import { BadRequestException } from '@nestjs/common';

import { registerDecorator } from 'class-validator';
import { decode, isAccountId } from '../utils';

export function IsSignatureMap() {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSignatureMap',
      target: object.constructor,
      propertyName: propertyName,
      validator: {
        validate(value) {
          if (!value || typeof value !== 'object')
            throw new BadRequestException('Signature map must be an object');

          for (const key in value) {
            if (!isAccountId(key) || !value[key] || typeof value[key] !== 'string')
              throw new BadRequestException('Invalid Signature map');

            value[key] = decode(value[key]);
          }
          return true;
        },
      },
    });
  };
}
