import { Transform } from 'class-transformer';
import { IsInt, IsString } from 'class-validator';

export class DeleteReviewerGroupDto {
  @IsInt()
  userKeyId: number;

  @Transform(({ value }) => (typeof value === 'string' && value.startsWith('0x') ? value.slice(2) : value))
  @IsString()
  userSignature: string;
}
