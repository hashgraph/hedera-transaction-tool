import type { Network } from '..';

export interface MigrateUserDataResult {
  accountsImported: number;
  publicKeysImported: number;
  defaultMaxTransactionFee: number | null;
  currentNetwork: Network;
}
