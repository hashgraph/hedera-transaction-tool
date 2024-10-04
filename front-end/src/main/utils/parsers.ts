import { Network } from '@main/shared/enums';

export function parseNetwork(value: string, defaultNetwork: Network): Network {
  value = value?.toLocaleLowerCase();

  return value?.includes('testnet')
    ? Network.TESTNET
    : value?.includes('mainnet')
      ? Network.MAINNET
      : value?.includes('previewnet')
        ? Network.PREVIEWNET
        : defaultNetwork;
}
