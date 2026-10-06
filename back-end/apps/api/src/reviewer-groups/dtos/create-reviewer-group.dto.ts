import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { MAX_REVIEWER_GROUP_DESCRIPTION_LENGTH, MAX_REVIEWER_GROUP_NAME_LENGTH } from '@entities';

export class GroupMemberInputDto {
  @IsInt()
  userId!: number;

  @IsInt()
  userKeyId!: number;
}

export class CreateReviewerGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_REVIEWER_GROUP_NAME_LENGTH)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(MAX_REVIEWER_GROUP_DESCRIPTION_LENGTH)
  description?: string;

  @IsInt()
  @Min(1)
  threshold!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupMemberInputDto)
  members!: GroupMemberInputDto[];

  @IsInt()
  userKeyId!: number;

  @Transform(({ value }) => (typeof value === 'string' && value.startsWith('0x') ? value.slice(2) : value))
  @IsString()
  userSignature!: string;
}
