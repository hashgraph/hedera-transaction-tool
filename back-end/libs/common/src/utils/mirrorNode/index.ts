import { LOCAL_NODE, MAINNET, PREVIEWNET, TESTNET } from '@app/common';

export const MirrorNetworkGRPC = {
  fromBaseURL(mirrorNetwork: string) {
    switch (mirrorNetwork) {
      case MAINNET:
        return MirrorNetworkGRPC.MAINNET;
      case TESTNET:
        return MirrorNetworkGRPC.TESTNET;
      case PREVIEWNET:
        return MirrorNetworkGRPC.PREVIEWNET;
      case LOCAL_NODE:
        return MirrorNetworkGRPC.LOCAL_NODE;
      default:
        return [mirrorNetwork.endsWith(':443') ? mirrorNetwork : `${mirrorNetwork}:443`];
    }
  },

  MAINNET: ['mainnet-public.mirrornode.hedera.com:443'],
  TESTNET: ['testnet.mirrornode.hedera.com:443'],
  PREVIEWNET: ['previewnet.mirrornode.hedera.com:443'],
  /* Using host.docker.internal to access the host machine from the container, will work only in dev mode */
  /* Local node will be used only in development mode */
  LOCAL_NODE: [`${process.env.NODE_ENV !== 'test' ? 'host.docker.internal' : '127.0.0.1'}:5600`],
};

export const MirrorNodeREST = {
  fromBaseURL(mirrorNetwork: string) {
    switch (mirrorNetwork) {
      case MAINNET:
        return MirrorNodeREST.MAINNET;
      case TESTNET:
        return MirrorNodeREST.TESTNET;
      case PREVIEWNET:
        return MirrorNodeREST.PREVIEWNET;
      case LOCAL_NODE:
        return MirrorNodeREST.LOCAL_NODE;
      default:
        return `https://${mirrorNetwork}`;
    }
  },

  MAINNET: 'https://mainnet-public.mirrornode.hedera.com',
  TESTNET: 'https://testnet.mirrornode.hedera.com',
  PREVIEWNET: 'https://previewnet.mirrornode.hedera.com',
  /* Using host.docker.internal to access the host machine from the container, will work only in dev mode */
  /* Local node will be used only in development mode */
  LOCAL_NODE: `http://${process.env.NODE_ENV !== 'test' ? 'host.docker.internal' : '127.0.0.1'}:8081`,
};
