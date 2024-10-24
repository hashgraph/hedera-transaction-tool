import { LOCAL_NODE, MAINNET, PREVIEWNET, TESTNET } from '@app/common';

export const MirrorNetwork = {
  fromURL(mirrorNodeRest: string) {
    switch (mirrorNodeRest) {
      case MAINNET:
        return MirrorNetwork.MAINNET;
      case TESTNET:
        return MirrorNetwork.TESTNET;
      case PREVIEWNET:
        return MirrorNetwork.PREVIEWNET;
      case LOCAL_NODE:
        return MirrorNetwork.LOCAL_NODE;
      default:
        return mirrorNodeRest;
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
  fromURL(mirrorNodeRest: string) {
    switch (mirrorNodeRest) {
      case MAINNET:
        return MirrorNodeBaseURL.MAINNET;
      case TESTNET:
        return MirrorNodeBaseURL.TESTNET;
      case PREVIEWNET:
        return MirrorNodeBaseURL.PREVIEWNET;
      case LOCAL_NODE:
        return MirrorNodeBaseURL.LOCAL_NODE;
      default:
        return mirrorNodeRest;
    }
  },

  MAINNET: 'https://mainnet-public.mirrornode.hedera.com/api/v1',
  TESTNET: 'https://testnet.mirrornode.hedera.com/api/v1',
  PREVIEWNET: 'https://previewnet.mirrornode.hedera.com/api/v1',
  /* Using host.docker.internal to access the host machine from the container, will work only in dev mode */
  /* Local node will be used only in development mode */
  LOCAL_NODE: `http://${process.env.NODE_ENV !== 'test' ? 'host.docker.internal' : '127.0.0.1'}:5551/api/v1`,
};
