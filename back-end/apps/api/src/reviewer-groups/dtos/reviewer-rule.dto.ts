import { Expose } from 'class-transformer';

import { EntityRole } from '@entities';

export class ReviewerRuleDto {
  @Expose() id: number;
  @Expose() groupId: number;
  @Expose() hederaEntityId: string;
  @Expose() network: string;
  @Expose() entityRole: EntityRole | null;
  @Expose() transactionType: string | null;
  @Expose() createdAt: Date;
}
