import type { Network, NetworkExchangeRateSetResponse } from '@main/shared/interfaces';

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { Client } from '@hashgraph/sdk';

import { CommonNetwork } from '@main/shared/enums';

import { getExchangeRateSet } from '@renderer/services/mirrorNodeDataService';
import { setClient } from '@renderer/services/transactionService';

import { getClientFromMirrorNode, getNodeNumbersFromNetwork } from '@renderer/utils';

const useNetworkStore = defineStore('network', () => {
  /* State */
  const network = ref<Network>(CommonNetwork.TESTNET);
  const mirrorNodeBaseURL = ref(getMirrorNodeREST(network.value));
  const exchangeRateSet = ref<NetworkExchangeRateSetResponse | null>(null);
  const client = ref<Client>(Client.forTestnet());
  const nodeNumbers = ref<number[]>([]);

  /* Getters */
  const currentRate = computed(() => {
    if (!exchangeRateSet.value) {
      throw new Error('Exchange rate set not found');
    }

    const timestamp = parseInt(exchangeRateSet.value.timestamp);

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
  async function setup(defaultNetwork?: Network) {
    await setNetwork(defaultNetwork || CommonNetwork.TESTNET);
  }

  async function setNetwork(newNetwork: Network) {
    await setClient(newNetwork);
    await setStoreClient(newNetwork);

    mirrorNodeBaseURL.value = getMirrorNodeREST(newNetwork);
    network.value = newNetwork;
    exchangeRateSet.value = await getExchangeRateSet(mirrorNodeBaseURL.value);

    nodeNumbers.value = await getNodeNumbersFromNetwork(mirrorNodeBaseURL.value);
  }

  async function setStoreClient(newNetwork: Network) {
    client.value.close();

    if (
      [CommonNetwork.MAINNET, CommonNetwork.TESTNET, CommonNetwork.PREVIEWNET].includes(newNetwork)
    ) {
      client.value = Client.forName(newNetwork);
      return;
    }

    if (newNetwork === CommonNetwork.LOCAL_NODE) {
      client.value = Client.forNetwork({
        '127.0.0.1:50211': '0.0.3',
      })
        .setMirrorNetwork('127.0.0.1:5600')
        .setLedgerId('3');
      return;
    }

    client.value = await getClientFromMirrorNode(newNetwork);
  }

  /* Helpers */
  function getMirrorNodeREST(network: Network) {
    const networkLink = {
      [CommonNetwork.MAINNET]: 'https://mainnet-public.mirrornode.hedera.com',
      [CommonNetwork.TESTNET]: 'https://testnet.mirrornode.hedera.com',
      [CommonNetwork.PREVIEWNET]: 'https://previewnet.mirrornode.hedera.com',
      [CommonNetwork.LOCAL_NODE]: 'http://localhost:5551',
    };

    if (!networkLink[network]) {
      return `https://${network}`;
    }

    return networkLink[network];
  }

  return {
    network,
    exchangeRateSet,
    mirrorNodeBaseURL,
    client,
    currentRate,
    nodeNumbers,
    setup,
    setNetwork,
    getMirrorNodeREST,
  };
});

export default useNetworkStore;
