import { computed, onMounted, ref } from 'vue';
import { defineStore } from 'pinia';

import { Client, Timestamp } from '@hashgraph/sdk';

import { NetworkExchangeRateSetResponse } from '../../main/shared/interfaces';

import { getExchangeRateSet } from '../services/mirrorNodeDataService';

export type Network = 'mainnet' | 'testnet' | 'previewnet' | 'custom';
export type CustomNetworkSettings = {
  consensusNodeEndpoint: string;
  mirrorNodeGRPCEndpoint: string;
  mirrorNodeRESTAPIEndpoint: string;
  nodeAccountId: string;
};

const useNetworkStore = defineStore('network', () => {
  /* State */
  const network = ref<Network>('testnet');
  const customNetworkSettings = ref<CustomNetworkSettings | null>(null);
  const exchangeRateSet = ref<NetworkExchangeRateSetResponse | null>(null);

  /* Getters */
  const mirrorNodeBaseURL = computed(() => getMirrorNodeLinkByNetwork(network.value));
  const client = computed(() => {
    switch (network.value) {
      case 'mainnet':
        return Client.forMainnet();
      case 'testnet':
        return Client.forTestnet();
      case 'previewnet':
        return Client.forPreviewnet();
      case 'custom':
        if (customNetworkSettings.value) {
          const node = {
            [customNetworkSettings.value.consensusNodeEndpoint]:
              customNetworkSettings.value.nodeAccountId,
          };
          return Client.forNetwork(node as any).setMirrorNetwork(
            customNetworkSettings.value.mirrorNodeGRPCEndpoint,
          );
        }
        throw Error('Settings for custom network are required');
      default:
        throw Error('Network not supported');
    }
  });
  const currentRate = computed(() => {
    if (!exchangeRateSet.value) {
      throw new Error('Exchange rate set not found');
    }

    const timestamp = Timestamp.generate().seconds.low;

    const networkCurrRate = exchangeRateSet.value.current_rate;
    let rate = networkCurrRate.cent_equivalent / networkCurrRate.hbar_equivalent / 100;

    const networkNextRate = exchangeRateSet.value.next_rate;

    if (timestamp > networkCurrRate.expiration_time) {
      rate = networkNextRate.cent_equivalent / networkNextRate.hbar_equivalent / 100;
    }

    if (timestamp > networkNextRate.expiration_time) {
      throw new Error('Exchange rate expired');
    }

    return rate;
  });

  /* Actions */
  async function setNetwork(newNetwork: Network, _customNetworkSettings?: CustomNetworkSettings) {
    if (newNetwork === 'custom') {
      if (!_customNetworkSettings) {
        throw Error('Settings for custom network are required');
      }
      customNetworkSettings.value = _customNetworkSettings;
    }

    network.value = newNetwork;

    exchangeRateSet.value = await getExchangeRateSet(mirrorNodeBaseURL.value);
  }

  /* Hooks */
  onMounted(async () => {
    exchangeRateSet.value = await getExchangeRateSet(mirrorNodeBaseURL.value);
  });

  /* Helpers */
  function getMirrorNodeLinkByNetwork(network: Network) {
    switch (network) {
      case 'mainnet':
      case 'testnet':
      case 'previewnet':
        return `https://${network}.mirrornode.hedera.com/api/v1`;
      case 'custom':
        if (customNetworkSettings.value) {
          return customNetworkSettings.value?.mirrorNodeRESTAPIEndpoint;
        }
        throw Error('Settings for custom network are required');
      default:
        throw Error('Invalid network');
    }
  }

  return {
    network,
    customNetworkSettings,
    exchangeRateSet,
    mirrorNodeBaseURL,
    client,
    currentRate,
    setNetwork,
    getMirrorNodeLinkByNetwork,
  };
});

export default useNetworkStore;
