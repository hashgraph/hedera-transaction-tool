import { Expose, Type } from 'class-transformer';

import { ReviewerGroupMemberDto } from './reviewer-group-member.dto';
import { ReviewerRuleDto } from './reviewer-rule.dto';

export class ReviewerGroupDetailDto {
  @Expose() id: number;
  @Expose() name: string;
  @Expose() description: string | null;
  @Expose() threshold: number;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;

  @Expose()
  @Type(() => ReviewerGroupMemberDto)
  members: ReviewerGroupMemberDto[];

  @Expose()
  @Type(() => ReviewerRuleDto)
  rules: ReviewerRuleDto[];
}
