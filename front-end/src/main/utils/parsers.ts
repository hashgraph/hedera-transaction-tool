import { CommonNetwork } from '@main/shared/enums';
import { Network } from '@main/shared/interfaces';

export function parseNetwork(value: string, defaultNetwork: Network): Network {
  value = value?.toLocaleLowerCase();

  return value?.includes('testnet')
    ? CommonNetwork.TESTNET
    : value?.includes('mainnet')
      ? CommonNetwork.MAINNET
      : value?.includes('previewnet')
        ? CommonNetwork.PREVIEWNET
        : defaultNetwork;
}
