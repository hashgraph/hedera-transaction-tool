import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator';
import { PublicKey } from '@hashgraph/sdk';
import { ErrorCodes } from '@app/common';

@ValidatorConstraint({ name: 'isHederaPublicKey', async: false })
export class IsHederaPublicKeyConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'string') return false;

    try {
      PublicKey.fromString(value);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return ErrorCodes.IPK;
  }
}

export function IsHederaPublicKey(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsHederaPublicKeyConstraint,
    });
  };
}