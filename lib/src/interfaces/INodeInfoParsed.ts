import type { AccountId, FileId, Hbar, Key, ServiceEndpoint } from '@hashgraph/sdk';
import type { TimestampRange } from './HederaSchema';

export interface INodeInfoParsed {
  adminKey: Key | null;
  description: string | null;
  fileId: FileId | null;
  memo: string | null;
  nodeId: number | null;
  nodeAccountId: AccountId | null;
  nodeCertHash: string | null;
  publicKey: string | null;
  serviceEndpoints: ServiceEndpoint[];
  timestamp: TimestampRange | null;
  maxStake: Hbar | null;
  minStake: Hbar | null;
  stake: Hbar | null;
  stakeNotRewarded: Hbar | null;
  stakeRewarded: Hbar | null;
  stakingPeriod: TimestampRange | null;
  rewardRateStart: Hbar | null;
  declineReward: boolean | null;
  grpcWebProxyEndpoint: ServiceEndpoint | null;
}
