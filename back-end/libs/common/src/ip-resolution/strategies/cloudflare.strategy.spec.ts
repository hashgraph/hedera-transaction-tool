import { Request } from 'express';
import { CloudflareIpStrategy } from './cloudflare.strategy';

const buildReq = (headers: Record<string, string | string[] | undefined>) => ({ headers }) as unknown as Request;

describe('CloudflareIpStrategy', () => {
  let strategy: CloudflareIpStrategy;

  beforeEach(() => {
    strategy = new CloudflareIpStrategy();
  });

  it('returns the CF-Connecting-IP header value', () => {
    expect(strategy.resolve(buildReq({ 'cf-connecting-ip': '203.0.113.5' }))).toBe('203.0.113.5');
  });

  it('trims surrounding whitespace', () => {
    expect(strategy.resolve(buildReq({ 'cf-connecting-ip': '  203.0.113.5  ' }))).toBe('203.0.113.5');
  });

  it('takes the first entry when the header arrives as an array', () => {
    expect(strategy.resolve(buildReq({ 'cf-connecting-ip': ['203.0.113.5', '198.51.100.1'] }))).toBe('203.0.113.5');
  });

  it('returns null when the header is missing', () => {
    expect(strategy.resolve(buildReq({}))).toBeNull();
  });

  it('returns null when the header is empty or whitespace-only', () => {
    expect(strategy.resolve(buildReq({ 'cf-connecting-ip': '' }))).toBeNull();
    expect(strategy.resolve(buildReq({ 'cf-connecting-ip': '   ' }))).toBeNull();
  });
});
