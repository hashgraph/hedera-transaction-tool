import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { GroupMemberInputDto } from './create-reviewer-group.dto';

export class UpdateReviewerGroupDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string | null;

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
  userKeyId: number;

  @Transform(({ value }) => (typeof value === 'string' && value.startsWith('0x') ? value.slice(2) : value))
  @IsString()
  @IsOptional()
  userSignature?: string | null;
}
