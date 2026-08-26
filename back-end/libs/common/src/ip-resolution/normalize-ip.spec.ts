import { normalizeIp } from './normalize-ip';

describe('normalizeIp', () => {
  it('collapses IPv4-mapped IPv6 to plain IPv4', () => {
    expect(normalizeIp('::ffff:203.0.113.5')).toBe('203.0.113.5');
  });

  it('collapses IPv4-mapped IPv6 regardless of prefix casing', () => {
    expect(normalizeIp('::FFFF:203.0.113.5')).toBe('203.0.113.5');
    expect(normalizeIp('::Ffff:203.0.113.5')).toBe('203.0.113.5');
  });

  it('lowercases a plain IPv6 address', () => {
    expect(normalizeIp('2001:DB8::1')).toBe('2001:db8::1');
  });

  it('leaves a plain IPv4 address unchanged', () => {
    expect(normalizeIp('203.0.113.5')).toBe('203.0.113.5');
  });

  it('leaves an already-lowercase IPv6 address unchanged', () => {
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8::1');
  });

  it('leaves a malformed value unchanged (not this function\'s job to validate)', () => {
    expect(normalizeIp('not-an-ip')).toBe('not-an-ip');
  });

  it('does not treat a garbage value merely starting with ::ffff: as IPv4-mapped', () => {
    // The suffix after ::ffff: isn't a valid IPv4 address, so this isn't collapsed --
    // it falls through to the IPv6 check, which also rejects it, so it's returned as-is.
    expect(normalizeIp('::ffff:not-an-ip')).toBe('::ffff:not-an-ip');
  });
});
