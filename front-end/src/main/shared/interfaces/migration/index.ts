import type { Network } from '..';

export interface MigrateUserDataResult {
  accountsImported: number;
  defaultMaxTransactionFee: number | null;
  currentNetwork: Network;
}
