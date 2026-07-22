import { IsString, MaxLength } from 'class-validator';

import { MAX_TRANSACTION_COMMENT_LENGTH } from '@entities';

export class CreateCommentDto {
  @IsString()
  @MaxLength(MAX_TRANSACTION_COMMENT_LENGTH)
  message: string;
}
