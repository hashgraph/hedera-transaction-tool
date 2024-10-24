import { LOCAL_NODE, MAINNET, PREVIEWNET, TESTNET } from '@app/common';
import { MirrorNetworkGRPC, MirrorNodeREST } from './index';

describe('MirrorNetworkGRPC', () => {
  describe('fromBaseURL', () => {
    it('should return MAINNET URL for MAINNET', () => {
      const result = MirrorNetworkGRPC.fromBaseURL(MAINNET);
      expect(result).toEqual(MirrorNetworkGRPC.MAINNET);
    });

    it('should return TESTNET URL for TESTNET', () => {
      const result = MirrorNetworkGRPC.fromBaseURL(TESTNET);
      expect(result).toEqual(MirrorNetworkGRPC.TESTNET);
    });

    it('should return PREVIEWNET URL for PREVIEWNET', () => {
      const result = MirrorNetworkGRPC.fromBaseURL(PREVIEWNET);
      expect(result).toEqual(MirrorNetworkGRPC.PREVIEWNET);
    });

    it('should return LOCAL_NODE URL for LOCAL_NODE', () => {
      const result = MirrorNetworkGRPC.fromBaseURL(LOCAL_NODE);
      expect(result).toEqual(MirrorNetworkGRPC.LOCAL_NODE);
    });

    it('should return custom URL with :443 if not ending with :443', () => {
      const customURL = 'custom.mirrornode.hedera.com';
      const result = MirrorNetworkGRPC.fromBaseURL(customURL);
      expect(result).toEqual([`${customURL}:443`]);
    });

    it('should return custom URL as is if ending with :443', () => {
      const customURL = 'custom.mirrornode.hedera.com:443';
      const result = MirrorNetworkGRPC.fromBaseURL(customURL);
      expect(result).toEqual([customURL]);
    });
  });
});

describe('MirrorNodeREST', () => {
  describe('fromBaseURL', () => {
    it('should return MAINNET URL for MAINNET', () => {
      const result = MirrorNodeREST.fromBaseURL(MAINNET);
      expect(result).toEqual(MirrorNodeREST.MAINNET);
    });

    it('should return TESTNET URL for TESTNET', () => {
      const result = MirrorNodeREST.fromBaseURL(TESTNET);
      expect(result).toEqual(MirrorNodeREST.TESTNET);
    });

    it('should return PREVIEWNET URL for PREVIEWNET', () => {
      const result = MirrorNodeREST.fromBaseURL(PREVIEWNET);
      expect(result).toEqual(MirrorNodeREST.PREVIEWNET);
    });

    it('should return LOCAL_NODE URL for LOCAL_NODE', () => {
      const result = MirrorNodeREST.fromBaseURL(LOCAL_NODE);
      expect(result).toEqual(MirrorNodeREST.LOCAL_NODE);
    });

    it('should return custom URL with https:// prefix', () => {
      const customURL = 'custom.mirrornode.hedera.com';
      const result = MirrorNodeREST.fromBaseURL(customURL);
      expect(result).toEqual(`https://${customURL}`);
    });
  });
});
