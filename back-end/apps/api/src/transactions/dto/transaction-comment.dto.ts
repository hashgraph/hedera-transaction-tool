import { Expose, Type } from 'class-transformer';
import { UserCoreDto } from '../../users/dtos';

export class TransactionCommentDto {
  @Expose()
  id: number;

  @Expose()
  @Type(() => UserCoreDto)
  user: UserCoreDto;

  @Expose()
  message: string;

  @Expose()
  createdAt: Date;
}
