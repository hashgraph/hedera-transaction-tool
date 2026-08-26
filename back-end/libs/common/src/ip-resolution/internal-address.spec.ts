import { isInternalAddress } from './internal-address';

describe('isInternalAddress', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['127.5.5.5', 'loopback, anywhere in 127.0.0.0/8, not just 127.0.0.1'],
    ['127.255.255.255', 'loopback, 127.0.0.0/8 upper bound'],
    ['::1', 'IPv6 loopback'],
    ['10.0.0.1', '10.0.0.0/8'],
    ['10.255.255.255', '10.0.0.0/8, upper bound'],
    ['192.168.1.100', '192.168.0.0/16'],
    ['172.16.0.1', '172.16.0.0/12, lower bound'],
    ['172.31.255.255', '172.16.0.0/12, upper bound'],
    ['169.254.1.1', 'link-local IPv4'],
    ['fc00::1', 'unique local IPv6'],
    ['fd12:3456::1', 'unique local IPv6'],
    ['fe80::1', 'link-local IPv6'],
    ['::ffff:10.0.0.1', 'IPv4-mapped IPv6, private'],
  ])('treats %s (%s) as internal', (ip) => {
    expect(isInternalAddress(ip)).toBe(true);
  });

  it.each([
    ['203.0.113.5', 'public IPv4'],
    ['126.255.255.255', 'just outside 127.0.0.0/8'],
    ['128.0.0.0', 'just outside 127.0.0.0/8'],
    ['172.32.0.1', 'just outside 172.16.0.0/12'],
    ['172.15.255.255', 'just outside 172.16.0.0/12'],
    ['2001:db8::1', 'public IPv6'],
    ['::ffff:203.0.113.5', 'IPv4-mapped IPv6, public'],
  ])('does not treat %s (%s) as internal', (ip) => {
    expect(isInternalAddress(ip)).toBe(false);
  });
});
