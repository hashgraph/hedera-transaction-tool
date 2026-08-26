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

  it('normalizes req.ip when falling back to it (e.g. Node reporting a dual-stack IPv4 client as IPv4-mapped IPv6)', () => {
    const resolver = new IpResolverService(buildConfig({}));

    expect(resolver.resolve(buildReq({}, '::ffff:203.0.113.9'))).toBe('203.0.113.9');
  });

  it('falls back to the cloudflare strategy for an unrecognized IP_TRUST_PROVIDER value', () => {
    const resolver = new IpResolverService(buildConfig({ IP_TRUST_PROVIDER: 'some-future-provider' }));
    const req = buildReq({ 'cf-connecting-ip': '203.0.113.5' });

    expect(resolver.resolve(req)).toBe('203.0.113.5');
  });

  it('falls back to req.ip and warns with request context and the fallback value when the header is missing and req.ip looks external', () => {
    const resolver = new IpResolverService(buildConfig({}));
    const warnSpy = jest.spyOn((resolver as unknown as { logger: { warn: jest.Mock } }).logger, 'warn');

    expect(resolver.resolve(buildReq({}, '203.0.113.9'))).toBe('203.0.113.9');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('could not resolve a client IP for POST /auth/login; falling back to req.ip (203.0.113.9)'),
    );
  });

  it('falls back to req.ip without warning when the header is missing but req.ip looks internal (health checks, other in-cluster callers)', () => {
    const resolver = new IpResolverService(buildConfig({}));
    const warnSpy = jest.spyOn((resolver as unknown as { logger: { warn: jest.Mock } }).logger, 'warn');

    expect(resolver.resolve(buildReq({}, '10.0.0.1'))).toBe('10.0.0.1');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["'; DROP TABLE users;--"],
    ['not-an-ip'],
    ['192.168.1.1, 10.0.0.1'], // whole raw CSV, no trailing valid IP after strategy parsing
    ['999.999.999.999'],
  ])(
    // req.ip is deliberately internal (10.0.0.1) here -- a malformed header value is
    // suspicious enough to warn about regardless of where the connection is from,
    // unlike a merely-missing header (see the internal-address test above).
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

  it('rejects a resolved value net.isIP considers invalid even if header-shaped', () => {
    const resolver = new IpResolverService(buildConfig({}));
    const req = buildReq({ 'cf-connecting-ip': '' }, '10.0.0.1');

    expect(resolver.resolve(req)).toBe('10.0.0.1');
  });
});
