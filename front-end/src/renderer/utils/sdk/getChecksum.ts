import { AccountId, Client } from '@hashgraph/sdk';
import useNetworkStore from '@renderer/stores/storeNetwork';

export const getAccountIdWithChecksum = (accountId: string): string => {
  const networkStore = useNetworkStore();
  try {
    return AccountId.fromString(accountId).toStringWithChecksum(networkStore.client as Client);
  } catch {
    return accountId;
  }
};
