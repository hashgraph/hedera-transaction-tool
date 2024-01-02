import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { Client } from '@hashgraph/sdk';

export type Network = 'mainnet' | 'testnet' | 'previewnet' | 'custom';
export type CustomNetworkSettings = {
  consensusNodeEndpoint: string;
  mirrorNodeGRPCEndpoint: string;
  mirrorNodeRESTAPIEndpoint: string;
  nodeAccountId: string | string;
};

const useNetworkStore = defineStore('network', () => {
  /* State */
  const network = ref<Network>('testnet');
  const customNetworkSettings = ref<CustomNetworkSettings | null>(null);

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

  /* Actions */
  async function setNetwork(newNetwork: Network, _customNetworkSettings?: CustomNetworkSettings) {
    if (newNetwork === 'custom') {
      if (!_customNetworkSettings) {
        throw Error('Settings for custom network are required');
      }
      customNetworkSettings.value = _customNetworkSettings;
    }

    network.value = newNetwork;
  }

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
        break;
    }
  }

  return {
    network,
    customNetworkSettings,
    mirrorNodeBaseURL,
    client,
    setNetwork,
    getMirrorNodeLinkByNetwork,
  };
});

export default useNetworkStore;
