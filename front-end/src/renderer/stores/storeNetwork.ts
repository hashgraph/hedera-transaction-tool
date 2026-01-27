/// <reference types="pino" />

import type { Network, NetworkExchangeRateSetResponse } from '@shared/interfaces';

import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { defineStore } from 'pinia';

import { Client } from '@hashgraph/sdk';

import { CommonNetwork, CommonNetworkNames } from '@shared/enums';

import { getExchangeRateSet } from '@renderer/services/mirrorNodeDataService';
import { setClient } from '@renderer/services/transactionService';

import {
  getClientFromMirrorNode,
  getNodeNumbersFromNetwork,
  isUserLoggedIn,
} from '@renderer/utils';
import useUserStore from '@renderer/stores/storeUser.ts';
import { add, getStoredClaim, update } from '@renderer/services/claimService';
import { SELECTED_NETWORK } from '@shared/constants';

export interface NetworkStore {
  network: Ref<string>;
  customMirrorNodeBaseURL: Ref<string | null>;
  exchangeRateSet: Ref<NetworkExchangeRateSetResponse | null>;
  allNetworks: ComputedRef<Network[]>;
  mirrorNodeBaseURL: ComputedRef<string>;
  client: Ref<Client>;
  currentRate: ComputedRef<number | null>;
  nodeNumbers: Ref<number[]>;
  setup: (defaultNetwork?: Network) => Promise<void>;
  setNetwork: (newNetwork: Network) => Promise<void>;
  getMirrorNodeREST: (network: Network) => string;
  getNetworkLabel: (network: Network) => string;
}

const useNetworkStore = defineStore('network', (): NetworkStore => {

  /* Stores */
  const user = useUserStore();

  /* State */
  const network = ref<Network>(CommonNetwork.MAINNET);
  const customMirrorNodeBaseURL = ref<string | null>(null);
  const exchangeRateSet = ref<NetworkExchangeRateSetResponse | null>(null);
  const client = ref<Client>(Client.forTestnet());
  const nodeNumbers = ref<number[]>([]);

  /* Computed */
  const CUSTOM_NETWORK: Network = "custom";
  const allNetworks = computed(() => {
    const result = Object.values(CommonNetwork);
    if (customMirrorNodeBaseURL.value !== null) {
      result.push(CUSTOM_NETWORK);
    }
    return result;
  })
  const mirrorNodeBaseURL = computed(() => {
    return getMirrorNodeREST(network.value);
  });

  const currentRate = computed(() => {
    if (!exchangeRateSet.value) {
      return null;
    }

    const timestamp = parseInt(exchangeRateSet.value.timestamp);

    const networkCurrRate = exchangeRateSet.value.current_rate;
    let rate = networkCurrRate.cent_equivalent / networkCurrRate.hbar_equivalent / 100;

    const networkNextRate = exchangeRateSet.value.next_rate;

    if (timestamp > networkCurrRate.expiration_time) {
      rate = networkNextRate.cent_equivalent / networkNextRate.hbar_equivalent / 100;
    }

    return rate;
  });

  /* Actions */
  async function setup(defaultNetwork?: Network) {
    await setNetwork(defaultNetwork || CommonNetwork.MAINNET);
    customMirrorNodeBaseURL.value =
      network.value in CommonNetworkNames ? null : getMirrorNodeREST(network.value);
  }

  async function setNetwork(newNetwork: Network) {
    if (isUserLoggedIn(user.personal)) {
      const selectedNetwork = await getStoredClaim(user.personal.id, SELECTED_NETWORK);
      const addOrUpdate = selectedNetwork !== undefined ? update : add;
      await addOrUpdate(user.personal.id, SELECTED_NETWORK, newNetwork);
    }
    await setClient(newNetwork);
    await setStoreClient(newNetwork);

    network.value = newNetwork; // mirrorNodeBaseURL is now usable
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
      [CommonNetwork.LOCAL_NODE]: 'http://localhost:8081',
    };

    if (!networkLink[network]) {
      return `https://${network}`;
    }

    return networkLink[network];
  }

  function getNetworkLabel(network: Network): string {
    let result: string;
    if (network === CUSTOM_NETWORK) {
      result = "custom";
    } else if (network in CommonNetworkNames) {
      result = CommonNetworkNames[network as keyof typeof CommonNetwork];
    } else {
      result = '?';
    }
    return result;
  }

  return {
    network,
    customMirrorNodeBaseURL,
    exchangeRateSet,
    allNetworks,
    mirrorNodeBaseURL,
    client: client as Ref<Client>,
    currentRate,
    nodeNumbers,
    setup,
    setNetwork,
    getMirrorNodeREST,
    getNetworkLabel,
  };
});

export default useNetworkStore;
