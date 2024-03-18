import { IsNotEmpty, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

// Validates that if the value is required, it is not empty,
// then attempts to convert the value to a Buffer and saves it to the dto.
export function IsBuffer(required: boolean = true): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol): void {
    if (required) {
      IsNotEmpty({ message: 'must be hex string' })(target, propertyKey); // Transform does not save the value without a validator (like IsNotEmpty)
    } else {
      IsOptional()(target, propertyKey);
    }
    Transform(({ value }) => (value ? Buffer.from(value, 'hex') : null));
  };
}

// export function IsCompanyName({ required }: { required: boolean }): PropertyDecorator {
//   return function (target: any,
//                    propertyKey: string | symbol): void {
//     IsString({ message: 'Must be text format' })(target, propertyKey);
//     MinLength(2, { message: "Must have at least 2 characters" })(target, propertyKey);
//     MaxLength(20, { message: "Can't be longer than 20 characters" })(target, propertyKey);
//     if (required)
//       IsDefined({ message: 'Must specify a receiver' })(target, propertyKey);
//     else
//       IsOptional()(target, propertyKey);
//   }
// }

// If this is needed for mulitple types of validators
// export function ValidatorComposer(validators: PropertyDecorator[], name: string): (options: { required: boolean }) => PropertyDecorator {
//   return function ({ required }: { required: boolean }) {
//     return function (target: any,
//                      propertyKey: string | symbol): void {
//       validators.forEach((validator) => validator(target, propertyKey));
//       if (required)
//         IsDefined({ message: 'Must specify a ' + name })(target, propertyKey);
//       else
//         IsOptional()(target, propertyKey);
//     }
//   }
// }
//
// export const IsCompanyName = ValidatorComposer([
//   IsString({ message: 'Must be text format' }),
//   MinLength(2, { message: "Must have at least 2 characters" }),
//   MaxLength(20, { message: "Can't be longer than 20 characters" })
// ], "receiver");
//
// export const IsCompanyDomain = ValidatorComposer([
//   IsString({ message: 'Must be text format' }),
//   MaxLength(253, { message: "Can't be longer than 253 characters" }),
//   IsFQDN({}, { message: 'Must be a valid domain name' })
// ], "domain");
//
// export const IsCompanyContact = ValidatorComposer([
//   IsPhoneNumber(null, { message: 'Must be a valid phone number' })
// ], "phone number");
//
// export const IsCompanySize = ValidatorComposer([
//   IsUUID()
// ], "company size");
//
// export const IsCompanyId = ValidatorComposer([
//   IsString({ message: 'Must be text format' }),
//   MaxLength(30, { message: "Can't be longer than 30 characters" })
// ], "");
