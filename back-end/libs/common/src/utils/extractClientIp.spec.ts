import { extractClientIp } from './extractClientIp';

describe('extractClientIp', () => {
  it('returns the CF-Connecting-IP header when present', () => {
    const req = {
      headers: { 'cf-connecting-ip': '203.0.113.9' },
      ip: '127.0.0.1',
    };

    expect(extractClientIp(req)).toBe('203.0.113.9');
  });

  it('trims whitespace from the CF-Connecting-IP header', () => {
    const req = {
      headers: { 'cf-connecting-ip': '  203.0.113.9  ' },
      ip: '127.0.0.1',
    };

    expect(extractClientIp(req)).toBe('203.0.113.9');
  });

  it('prefers CF-Connecting-IP over X-Forwarded-For and req.ip', () => {
    const req = {
      headers: {
        'cf-connecting-ip': '203.0.113.9',
        'x-forwarded-for': '198.51.100.1, 10.0.0.1',
      },
      ip: '127.0.0.1',
    };

    expect(extractClientIp(req)).toBe('203.0.113.9');
  });

  it('falls back to X-Forwarded-For when CF-Connecting-IP is absent', () => {
    const req = {
      headers: { 'x-forwarded-for': '198.51.100.1, 10.0.0.1' },
      ip: '127.0.0.1',
    };

    expect(extractClientIp(req)).toBe('198.51.100.1');
  });

  it('uses the leftmost value and trims it from a multi-value X-Forwarded-For header', () => {
    const req = {
      headers: { 'x-forwarded-for': '  198.51.100.1  , 10.0.0.1, 10.0.0.2' },
      ip: '127.0.0.1',
    };

    expect(extractClientIp(req)).toBe('198.51.100.1');
  });

  it('ignores an empty CF-Connecting-IP header and falls back to X-Forwarded-For', () => {
    const req = {
      headers: { 'cf-connecting-ip': '   ', 'x-forwarded-for': '198.51.100.1' },
      ip: '127.0.0.1',
    };

    expect(extractClientIp(req)).toBe('198.51.100.1');
  });

  it('ignores an empty X-Forwarded-For header and falls back to req.ip', () => {
    const req = {
      headers: { 'x-forwarded-for': '' },
      ip: '127.0.0.1',
    };

    expect(extractClientIp(req)).toBe('127.0.0.1');
  });

  it('falls back to req.ip when headers are missing entirely', () => {
    const req = { headers: {}, ip: '127.0.0.1' };

    expect(extractClientIp(req)).toBe('127.0.0.1');
  });

  it('falls back to req.ip when CF-Connecting-IP is provided as a header array (string[])', () => {
    const req = {
      headers: { 'cf-connecting-ip': ['203.0.113.9', '203.0.113.10'] },
      ip: '127.0.0.1',
    };

    expect(extractClientIp(req)).toBe('127.0.0.1');
  });

  it('falls back to req.ip when X-Forwarded-For is provided as a header array (string[])', () => {
    const req = {
      headers: { 'x-forwarded-for': ['198.51.100.1', '10.0.0.1'] },
      ip: '127.0.0.1',
    };

    expect(extractClientIp(req)).toBe('127.0.0.1');
  });

  it('returns undefined when no IP can be determined', () => {
    const req = { headers: {}, ip: undefined };

    expect(extractClientIp(req)).toBeUndefined();
  });
});
