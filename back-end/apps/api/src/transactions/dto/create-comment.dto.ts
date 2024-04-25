import { IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  message: string;
}
