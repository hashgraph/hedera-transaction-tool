import { Network } from '@entities';

export const MirrorNetwork = {
  fromName(name: Network) {
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
  /* Using host.docker.internal to access the host machine from the container, will work only in dev mode */
  /* Local node will be used only in development mode */
  LOCAL_NODE: [`${process.env.NODE_ENV !== 'test' ? 'host.docker.internal' : '127.0.0.1'}:5600`],
};

export const MirrorNodeBaseURL = {
  fromName(name: Network) {
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
  /* Using host.docker.internal to access the host machine from the container, will work only in dev mode */
  /* Local node will be used only in development mode */
  LOCAL_NODE: `http://${process.env.NODE_ENV !== 'test' ? 'host.docker.internal' : '127.0.0.1'}:5551/api/v1`,
};
