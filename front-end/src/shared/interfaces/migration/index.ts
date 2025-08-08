import type { Network } from '../index';

export interface MigrateUserDataResult {
  accountsImported: number;
  publicKeysImported: number;
  defaultMaxTransactionFee: number | null;
  currentNetwork: Network;
}
