import {
  BlockNodeServiceEndpoint,
  GeneralServiceEndpoint,
  MirrorNodeServiceEndpoint,
} from '@hiero-ledger/sdk';
import {
  compareServiceEndpoint,
  compareServiceEndpoints,
} from '@renderer/utils/sdk/registeredServiceEndpoints.ts';


describe('registeredServiceEndpoint', () => {

  describe('compareServiceEndpoint', () => {
    test('type', () => {
      const p1 = new MirrorNodeServiceEndpoint();
      const p2 = new MirrorNodeServiceEndpoint();
      const p3 = new GeneralServiceEndpoint();
      expect(compareServiceEndpoint(p1, p2)).toBe(true);
      expect(compareServiceEndpoint(p1, p3)).toBe(false);
    });

    test('ipAddress', () => {
      const p1 = new MirrorNodeServiceEndpoint();
      const p2 = new MirrorNodeServiceEndpoint();
      expect(compareServiceEndpoint(p1, p2)).toBe(true);

      p1.setIpAddress(Uint8Array.from([127, 0, 0, 1]));
      expect(compareServiceEndpoint(p1, p2)).toBe(false);

      p2.setIpAddress(Uint8Array.from([127, 0, 0, 1]));
      expect(compareServiceEndpoint(p1, p2)).toBe(true);
    });

    test('domainName', () => {
      const p1 = new MirrorNodeServiceEndpoint();
      const p2 = new MirrorNodeServiceEndpoint();
      expect(compareServiceEndpoint(p1, p2)).toBe(true);

      p1.setDomainName('localhost');
      expect(compareServiceEndpoint(p1, p2)).toBe(false);

      p2.setDomainName('localhost');
      expect(compareServiceEndpoint(p1, p2)).toBe(true);
    });

    test('port', () => {
      const p1 = new MirrorNodeServiceEndpoint();
      const p2 = new MirrorNodeServiceEndpoint();
      expect(compareServiceEndpoint(p1, p2)).toBe(true);

      p1.setPort(42);
      expect(compareServiceEndpoint(p1, p2)).toBe(false);

      p2.setPort(42);
      expect(compareServiceEndpoint(p1, p2)).toBe(true);
    });

    test('BlockNodeServiceEndpoint.endpointApis', () => {
      const p1 = new BlockNodeServiceEndpoint();
      const p2 = new BlockNodeServiceEndpoint();
      expect(compareServiceEndpoint(p1, p2)).toBe(true);

      p1.setEndpointApis([]);
      expect(compareServiceEndpoint(p1, p2)).toBe(false);

      p2.setEndpointApis([]);
      expect(compareServiceEndpoint(p1, p2)).toBe(true);

      p1.setEndpointApis([1]);
      expect(compareServiceEndpoint(p1, p2)).toBe(false);

      p2.setEndpointApis([1]);
      expect(compareServiceEndpoint(p1, p2)).toBe(true);

      p1.setEndpointApis([1, 2]);
      expect(compareServiceEndpoint(p1, p2)).toBe(false);

      p2.setEndpointApis([1, 3]);
      expect(compareServiceEndpoint(p1, p2)).toBe(false);
    });
  });

  test('GeneralServiceEndpoint.description', () => {
    const p1 = new GeneralServiceEndpoint();
    const p2 = new GeneralServiceEndpoint();
    expect(compareServiceEndpoint(p1, p2)).toBe(true);

    p1.setDescription('Nice description');
    expect(compareServiceEndpoint(p1, p2)).toBe(false);

    p2.setDescription('Nice description');
    expect(compareServiceEndpoint(p1, p2)).toBe(true);
  });

  test('compareServiceEndpoints', () => {
    const p1 = new MirrorNodeServiceEndpoint();
    const p2 = new GeneralServiceEndpoint();

    expect(compareServiceEndpoints([p1], [])).toBe(false);
    expect(compareServiceEndpoints([p1], [p1])).toBe(true);
    expect(compareServiceEndpoints([p1], [p2])).toBe(false);
    expect(compareServiceEndpoints([p1], [p1, p2])).toBe(false);
    expect(compareServiceEndpoints([p1, p2], [p1, p2])).toBe(true);
  });
});
