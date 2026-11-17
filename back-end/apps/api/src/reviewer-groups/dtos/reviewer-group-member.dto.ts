import { Expose } from 'class-transformer';

export class ReviewerGroupMemberDto {
  @Expose() id!: number;
  @Expose() groupId!: number;
  @Expose() userId!: number;
  @Expose() userKeyId!: number;
  // Resolved separately from UserKey — see getGroup. A member whose key can't be resolved
  // (their user was removed from the org) is dropped rather than included with no key.
  @Expose() publicKey!: string;
  @Expose() createdAt!: Date;
}
