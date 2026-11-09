import axios from 'axios';

import { CommonNetwork } from '@shared/enums';

import type { AbiItem } from '@renderer/utils/sdk/abi';

import { createLogger } from '@renderer/utils/logger';

const logger = createLogger('renderer.sourcifyService');

const SOURCIFY_API = 'https://sourcify.dev/server/v2';

// Hedera EVM chain ids. Custom / local networks have no Sourcify entry.
const CHAIN_IDS: Record<string, number> = {
  [CommonNetwork.MAINNET]: 295,
  [CommonNetwork.TESTNET]: 296,
  [CommonNetwork.PREVIEWNET]: 297,
};

export interface VerifiedContract {
  name: string;
  match: 'exact_match' | 'match';
  abi: AbiItem[];
  sources: { path: string; content: string }[];
}

export const isSourcifySupported = (network: string) => network in CHAIN_IDS;

/*
 * Looks up a verified contract on Sourcify. Resolves to `null` when the contract is not verified
 * (404), the network is unsupported, or the request fails for any reason - callers then fall back
 * to a user-uploaded ABI, so a Sourcify outage must never block adding a contract.
 */
export const getVerifiedContract = async (
  network: string,
  evmAddress: string,
  controller?: AbortController,
): Promise<VerifiedContract | null> => {
  const chainId = CHAIN_IDS[network];
  if (!chainId) {
    return null;
  }

  try {
    const { data } = await axios.get(`${SOURCIFY_API}/contract/${chainId}/${evmAddress}`, {
      params: { fields: 'abi,sources,compilation' },
      signal: controller?.signal,
    });

    if (!Array.isArray(data.abi)) {
      return null;
    }

    const sources = Object.entries<{ content: string }>(data.sources ?? {}).map(
      ([path, { content }]) => ({ path: path.replace(/^project:\//, ''), content }),
    );

    return {
      name: data.compilation?.name ?? '',
      match: data.match,
      abi: data.abi,
      sources,
    };
  } catch (error) {
    if (!axios.isCancel(error) && !(axios.isAxiosError(error) && error.response?.status === 404)) {
      logger.warn('Sourcify lookup failed', { error });
    }
    return null;
  }
};
