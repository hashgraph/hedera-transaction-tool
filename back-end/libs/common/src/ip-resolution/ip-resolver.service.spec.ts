import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { IpResolverService } from './ip-resolver.service';

const buildReq = (headers: Record<string, string | string[] | undefined>, ip = '127.0.0.1') =>
  ({ headers, ip, method: 'POST', originalUrl: '/auth/login' }) as unknown as Request;

const buildConfig = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, defaultValue?: unknown) =>
      key in values ? values[key] : defaultValue,
    ),
  }) as unknown as ConfigService;

describe('IpResolverService', () => {
  it('defaults to the cloudflare strategy and resolves CF-Connecting-IP', () => {
    const resolver = new IpResolverService(buildConfig({}));
    const req = buildReq({ 'cf-connecting-ip': '203.0.113.5' });

    expect(resolver.resolve(req)).toBe('203.0.113.5');
  });

  it('resolves an IPv6 address', () => {
    const resolver = new IpResolverService(buildConfig({}));
    const req = buildReq({ 'cf-connecting-ip': '2001:db8::1' });

    expect(resolver.resolve(req)).toBe('2001:db8::1');
  });

  it('normalizes an IPv4-mapped IPv6 header value to plain IPv4', () => {
    const resolver = new IpResolverService(buildConfig({}));
    const req = buildReq({ 'cf-connecting-ip': '::ffff:203.0.113.5' });

    expect(resolver.resolve(req)).toBe('203.0.113.5');
  });

  it('lowercases an IPv6 header value', () => {
    const resolver = new IpResolverService(buildConfig({}));
    const req = buildReq({ 'cf-connecting-ip': '2001:DB8::1' });

    expect(resolver.resolve(req)).toBe('2001:db8::1');
  });

  it('compresses a fully-expanded IPv6 header value to its canonical zero-run form', () => {
    const resolver = new IpResolverService(buildConfig({}));
    const req = buildReq({ 'cf-connecting-ip': '2001:0db8:0000:0000:0000:0000:0000:0001' });

    expect(resolver.resolve(req)).toBe('2001:db8::1');
  });

  it('normalizes req.ip when falling back to it (e.g. Node reporting a dual-stack IPv4 client as IPv4-mapped IPv6)', () => {
    const resolver = new IpResolverService(buildConfig({}));

    expect(resolver.resolve(buildReq({}, '::ffff:203.0.113.9'))).toBe('203.0.113.9');
  });

  it('falls back to the cloudflare strategy for an unrecognized IP_TRUST_PROVIDER value', () => {
    const resolver = new IpResolverService(buildConfig({ IP_TRUST_PROVIDER: 'some-future-provider' }));
    const req = buildReq({ 'cf-connecting-ip': '203.0.113.5' });

    expect(resolver.resolve(req)).toBe('203.0.113.5');
  });

  it.each([
    ['203.0.113.9', 'public IPv4'],
    ['2001:db8::1', 'documentation-range IPv6 -- reserved, but not one of our "internal" buckets'],
  ])(
    'falls back to req.ip and warns with request context and the fallback value when the header is missing and req.ip is external (%s, %s)',
    (ip) => {
      const resolver = new IpResolverService(buildConfig({}));
      const warnSpy = jest.spyOn((resolver as unknown as { logger: { warn: jest.Mock } }).logger, 'warn');

      expect(resolver.resolve(buildReq({}, ip))).toBe(ip);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`could not resolve a client IP for POST /auth/login; falling back to req.ip (${ip})`),
      );
    },
  );

  // One representative address per ipaddr.js range bucket we treat as "internal" --
  // this is checking that we wired up the right bucket names, not re-verifying
  // ipaddr.js's own CIDR boundary math (that's its library's job, not ours).
  it.each([
    ['127.0.0.1', 'loopback'],
    ['10.0.0.1', 'private (RFC 1918)'],
    ['169.254.1.1', 'link-local IPv4'],
    ['fc00::1', 'unique local IPv6'],
    ['fe80::1', 'link-local IPv6'],
  ])(
    'falls back to req.ip without warning when the header is missing but req.ip is internal (%s, %s) -- health checks, other in-cluster callers',
    (ip) => {
      const resolver = new IpResolverService(buildConfig({}));
      const warnSpy = jest.spyOn((resolver as unknown as { logger: { warn: jest.Mock } }).logger, 'warn');

      expect(resolver.resolve(buildReq({}, ip))).toBe(ip);
      expect(warnSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["'; DROP TABLE users;--"],
    ['not-an-ip'],
    ['192.168.1.1, 10.0.0.1'], // whole raw CSV, no trailing valid IP after strategy parsing
    ['999.999.999.999'],
  ])(
    // req.ip is deliberately internal (10.0.0.1) here -- a malformed header value is
    // suspicious enough to warn about regardless of where the connection is from,
    // unlike a merely-missing header (see the internal-vs-external tests above).
    'falls back to req.ip and warns on a malformed header value even from an internal address (%s)',
    (malformed) => {
      const resolver = new IpResolverService(buildConfig({}));
      const warnSpy = jest.spyOn((resolver as unknown as { logger: { warn: jest.Mock } }).logger, 'warn');

      expect(resolver.resolve(buildReq({ 'cf-connecting-ip': malformed }, '10.0.0.1'))).toBe('10.0.0.1');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('for POST /auth/login; falling back to req.ip (10.0.0.1)'),
      );
    },
  );

  it('falls back to "0.0.0.0" when there is no header and no req.ip', () => {
    const resolver = new IpResolverService(buildConfig({}));
    const req = { headers: {}, ip: undefined } as unknown as Request;

    expect(resolver.resolve(req)).toBe('0.0.0.0');
  });

  it('rejects a resolved value that is invalid even if header-shaped', () => {
    const resolver = new IpResolverService(buildConfig({}));
    const req = buildReq({ 'cf-connecting-ip': '' }, '10.0.0.1');

    expect(resolver.resolve(req)).toBe('10.0.0.1');
  });

  it('never throws, even if req.ip itself is somehow malformed (violates Express\'s own contract)', () => {
    const resolver = new IpResolverService(buildConfig({}));
    const req = buildReq({}, 'not-a-real-ip');

    expect(() => resolver.resolve(req)).not.toThrow();
    expect(resolver.resolve(req)).toBe('not-a-real-ip');
  });
});
