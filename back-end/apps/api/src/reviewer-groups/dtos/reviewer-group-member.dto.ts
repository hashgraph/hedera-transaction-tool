import { Expose } from 'class-transformer';

export class ReviewerGroupMemberDto {
  @Expose() id: number;
  @Expose() groupId: number;
  @Expose() userId: number;
  @Expose() userKeyId: number;
  @Expose() createdAt: Date;
}
