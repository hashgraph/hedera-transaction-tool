import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { ApiHideProperty } from '@nestjs/swagger';

import { EntityRole } from '@entities';

function MustBeAbsent(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'mustBeAbsent',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} is reserved and must not be submitted`, ...options },
      validator: { validate: (value: unknown) => value === undefined },
    });
  };
}

export class CreateReviewerRuleDto {
  @IsInt()
  groupId: number;

  @IsString()
  @IsNotEmpty()
  hederaEntityId: string;

  @IsString()
  @IsNotEmpty()
  network: string;

  @IsEnum(EntityRole)
  @IsOptional()
  entityRole?: EntityRole;

  @IsString()
  @IsOptional()
  transactionType?: string;

  // condition is reserved for future use; submitting it is an error.
  // The @MustBeAbsent decorator keeps the property whitelisted (so ValidationPipe doesn't
  // strip it silently) while failing validation if any value is present.
  @ApiHideProperty()
  @MustBeAbsent()
  condition?: never;

  @IsInt()
  userKeyId: number;

  @Transform(({ value }) => (typeof value === 'string' && value.startsWith('0x') ? value.slice(2) : value))
  @IsString()
  userSignature: string;
}
