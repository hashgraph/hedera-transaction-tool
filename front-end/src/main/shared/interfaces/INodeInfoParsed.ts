import type { AccountId, FileId, Hbar, Key, ServiceEndpoint } from '@hashgraph/sdk';
import type { TimestampRange } from './HederaSchema';

export interface INodeInfoParsed {
  admin_key: Key | null;
  description: string | null;
  file_id: FileId | null;
  memo: string | null;
  node_id: number | null;
  node_account_id: AccountId | null;
  node_cert_hash: string | null;
  public_key: string | null;
  service_endpoints: ServiceEndpoint[];
  timestamp: TimestampRange | null;
  max_stake: Hbar | null;
  min_stake: Hbar | null;
  stake: Hbar | null;
  stake_not_rewarded: Hbar | null;
  stake_rewarded: Hbar | null;
  staking_period: TimestampRange | null;
  reward_rate_start: Hbar | null;
  decline_reward: boolean;
}
