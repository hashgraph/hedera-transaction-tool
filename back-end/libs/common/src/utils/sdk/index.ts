import { NetworkName } from '@hashgraph/sdk/lib/client/Client';

export * from './transaction';
export * from './client';
export * from './key';
export * from './account';

export type Network = NetworkName | 'local-node';
export const NETWORKS: Network[] = ['mainnet', 'testnet', 'previewnet', 'local-node'];
