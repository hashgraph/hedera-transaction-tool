import {} from '@hashgraph/sdk';

export const MirrorNetwork = {
  fromName(name: string) {
    switch (name) {
      case 'mainnet':
        return MirrorNetwork.MAINNET;

      case 'testnet':
        return MirrorNetwork.TESTNET;

      case 'previewnet':
        return MirrorNetwork.PREVIEWNET;

      case 'local-node':
        return MirrorNetwork.LOCAL_NODE;

      default:
        throw new Error(`Unknown network name: ${name}`);
    }
  },

  MAINNET: ['mainnet-public.mirrornode.hedera.com:443'],
  TESTNET: ['testnet.mirrornode.hedera.com:443'],
  PREVIEWNET: ['previewnet.mirrornode.hedera.com:443'],
  LOCAL_NODE: ['127.0.0.1:5600'],
};

export const MirrorNodeBaseURL = {
  fromName(name: string) {
    switch (name) {
      case 'mainnet':
        return MirrorNodeBaseURL.MAINNET;

      case 'testnet':
        return MirrorNodeBaseURL.TESTNET;

      case 'previewnet':
        return MirrorNodeBaseURL.PREVIEWNET;

      case 'local-node':
        return MirrorNodeBaseURL.LOCAL_NODE;

      default:
        throw new Error(`Unknown network name: ${name}`);
    }
  },

  MAINNET: 'https://mainnet-public.mirrornode.hedera.com/api/v1',
  TESTNET: 'https://testnet.mirrornode.hedera.com/api/v1',
  PREVIEWNET: 'https://previewnet.mirrornode.hedera.com/api/v1',
  LOCAL_NODE: 'http://localhost:5551/api/v1',
};
