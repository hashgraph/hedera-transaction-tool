export type ApiKeyRevokedReason =
  | 'user'
  | 'permission_removed'
  | 'user_removed'
  | 'inactivity';

export interface IApiKeyStatus {
  hasKey: boolean;
  keyId: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedReason: ApiKeyRevokedReason | null;
  idleExpiryDays: number;
}
