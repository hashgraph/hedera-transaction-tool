import { AccountId, EvmAddress, Hbar, Key, Timestamp } from '@hashgraph/sdk';

export interface IAccountInfoParsed {
  accountId: AccountId;
  alias: string | null;
  balance: Hbar;
  declineReward: boolean;
  deleted: boolean;
  ethereumNonce: number;
  evmAddress: EvmAddress;
  createdTimestamp: Timestamp | null;
  expiryTimestamp: Timestamp | null;
  key: Key | null;
  maxAutomaticTokenAssociations: number | null;
  memo: string | null;
  pendingRewards: Hbar;
  receiverSignatureRequired: boolean;
  stakedAccountId: AccountId | null;
  stakedNodeId: number | null;
  autoRenewPeriod: number | null;
}
