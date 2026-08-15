import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class GroupMemberInputDto {
  @IsInt()
  userId: number;

  @IsInt()
  userKeyId: number;
}

export class CreateReviewerGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsInt()
  @Min(1)
  threshold: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupMemberInputDto)
  members: GroupMemberInputDto[];

  @IsInt()
  userKeyId: number;

  @Transform(({ value }) => (typeof value === 'string' && value.startsWith('0x') ? value.slice(2) : value))
  @IsString()
  @IsOptional()
  userSignature?: string | null;
}
