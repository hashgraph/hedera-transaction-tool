import { Expose } from 'class-transformer';

import { ApiKeyRevokedReason } from '@entities';

export class ApiKeyStatusDto {
  @Expose() hasKey!: boolean;
  @Expose() keyId!: string | null;
  @Expose() createdAt!: Date | null;
  @Expose() lastUsedAt!: Date | null;
  @Expose() revokedAt!: Date | null;
  @Expose() revokedReason!: ApiKeyRevokedReason | null;
  @Expose() idleExpiryDays!: number;
}
