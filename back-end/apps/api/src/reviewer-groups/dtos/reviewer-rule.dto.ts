import { Expose } from 'class-transformer';

import { EntityRole } from '@entities';

export class ReviewerRuleDto {
  @Expose() id!: number;
  @Expose() groupId!: number;
  // A Hedera entity ID (e.g. "0.0.1234") for most entityRoles, or a plain node ID
  // (e.g. "1") when entityRole is 'node'.
  @Expose() hederaId!: string;
  @Expose() network!: string;
  @Expose() entityRole!: EntityRole | null;
  @Expose() transactionType!: string | null;
  @Expose() createdAt!: Date;
}
