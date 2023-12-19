import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { Client } from '@hashgraph/sdk';

const useNetworkStore = defineStore('network', () => {
  /* State */
  const network = ref<'mainnet' | 'testnet' | 'previewnet'>('testnet');

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
      default:
        throw Error('Network not supported');
    }
  });

  /* Actions */
  async function setNetwork(newNetwork: 'mainnet' | 'testnet' | 'previewnet') {
    network.value = newNetwork;
  }

  /* Helpers */
  function getMirrorNodeLinkByNetwork(network: 'mainnet' | 'testnet' | 'previewnet') {
    return `https://${network}.mirrornode.hedera.com/api/v1`;
  }

  return { network, mirrorNodeBaseURL, client, setNetwork, getMirrorNodeLinkByNetwork };
});

export default useNetworkStore;
