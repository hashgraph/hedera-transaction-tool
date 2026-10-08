import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

import { MAX_REVIEWER_GROUP_DESCRIPTION_LENGTH, MAX_REVIEWER_GROUP_NAME_LENGTH } from '@entities';

import { GroupMemberInputDto } from './create-reviewer-group.dto';

export class UpdateReviewerGroupDto {
  @IsString()
  @IsOptional()
  @MaxLength(MAX_REVIEWER_GROUP_NAME_LENGTH)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(MAX_REVIEWER_GROUP_DESCRIPTION_LENGTH)
  description?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  threshold?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupMemberInputDto)
  @IsOptional()
  members?: GroupMemberInputDto[];

  @IsInt()
  userKeyId!: number;

  @Transform(({ value }) => (typeof value === 'string' && value.startsWith('0x') ? value.slice(2) : value))
  @IsString()
  userSignature!: string;
}
