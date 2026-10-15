import { ServiceEndpoint } from '@hiero-ledger/sdk';
import { compareNodeServiceEndpoint } from '@renderer/utils/sdk/serviceEndpoints.ts';

describe('serviceEndpoint', () => {

  describe('compareNodeServiceEndpoint', () => {
    test('setIpAddressV4', () => {
      const p1 = new ServiceEndpoint();
      const p2 = new ServiceEndpoint();
      expect(compareNodeServiceEndpoint(p1, p2)).toBe(true);

      p1.setIpAddressV4(Uint8Array.from([127, 0, 0, 1]));
      expect(compareNodeServiceEndpoint(p1, p2)).toBe(false);

      p2.setIpAddressV4(Uint8Array.from([127, 0, 0, 1]));
      expect(compareNodeServiceEndpoint(p1, p2)).toBe(true);
    });

    test('setDomainName', () => {
      const p1 = new ServiceEndpoint();
      const p2 = new ServiceEndpoint();
      expect(compareNodeServiceEndpoint(p1, p2)).toBe(true);

      p1.setDomainName('example.com');
      expect(compareNodeServiceEndpoint(p1, p2)).toBe(false);

      p2.setDomainName('example.com');
      expect(compareNodeServiceEndpoint(p1, p2)).toBe(true);
    });
  });

  test('setPort', () => {
    const p1 = new ServiceEndpoint();
    const p2 = new ServiceEndpoint();
    expect(compareNodeServiceEndpoint(p1, p2)).toBe(true);

    p1.setPort(4242);
    expect(compareNodeServiceEndpoint(p1, p2)).toBe(false);

    p2.setPort(4242);
    expect(compareNodeServiceEndpoint(p1, p2)).toBe(true);
  });
});
