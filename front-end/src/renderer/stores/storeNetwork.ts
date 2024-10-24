import type { Network, NetworkExchangeRateSetResponse } from '@main/shared/interfaces';

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { Client, Timestamp } from '@hashgraph/sdk';

import { CommonNetwork } from '@main/shared/enums';

import { getExchangeRateSet } from '@renderer/services/mirrorNodeDataService';
import { setClient } from '@renderer/services/transactionService';

import { getNodeNumbersFromNetwork } from '@renderer/utils';

export type CustomNetworkSettings = {
  nodeAccountIds: {
    [key: string]: string;
  };
  mirrorNodeGRPCEndpoint: string;
  mirrorNodeRESTAPIEndpoint: string;
};

const useNetworkStore = defineStore('network', () => {
  /* State */
  const network = ref<Network>(CommonNetwork.TESTNET);
  const customNetworkSettings = ref<CustomNetworkSettings | null>(null);
  const exchangeRateSet = ref<NetworkExchangeRateSetResponse | null>(null);

  /* Getters */
  const mirrorNodeBaseURL = computed(() => getMirrorNodeLinkByNetwork(network.value));

  const client = computed(() => {
    switch (network.value) {
      case CommonNetwork.MAINNET:
        return Client.forMainnet();
      case CommonNetwork.TESTNET:
        return Client.forTestnet();
      case CommonNetwork.PREVIEWNET:
        return Client.forPreviewnet();
      case CommonNetwork.LOCAL_NODE:
        return Client.forNetwork({
          '127.0.0.1:50211': '0.0.3',
        })
          .setMirrorNetwork('127.0.0.1:5600')
          .setLedgerId('3');
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

  const nodeNumbers = computed(() => {
    return getNodeNumbersFromNetwork(client.value.network);
  });

  /* Actions */
  async function setup() {
    await setNetwork(CommonNetwork.TESTNET);
  }

  async function setNetwork(newNetwork: Network) {
    await setClient(newNetwork);
    network.value = newNetwork;
    exchangeRateSet.value = await getExchangeRateSet(mirrorNodeBaseURL.value);
  }

  /* Helpers */
  function getMirrorNodeLinkByNetwork(network: Network) {
    const MAINNET = 'https://mainnet-public.mirrornode.hedera.com/api/v1';
    const TESTNET = 'https://testnet.mirrornode.hedera.com/api/v1';
    const PREVIEWNET = 'https://previewnet.mirrornode.hedera.com/api/v1';
    const LOCAL_NODE = 'http://localhost:5551/api/v1';

    switch (network) {
      case 'mainnet':
        return MAINNET;
      case 'testnet':
        return TESTNET;
      case 'previewnet':
        return PREVIEWNET;
      case 'local-node':
        return LOCAL_NODE;
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
    nodeNumbers,
    setup,
    setNetwork,
    getMirrorNodeLinkByNetwork,
  };
});

export default useNetworkStore;
