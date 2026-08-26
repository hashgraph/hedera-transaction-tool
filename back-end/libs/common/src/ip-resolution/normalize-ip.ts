import * as net from 'net';

/**
 * Collapses IPv4-mapped IPv6 notation (`::ffff:1.2.3.4`) to plain IPv4 (`1.2.3.4`) and
 * lowercases IPv6 addresses, so two different string representations of the same
 * address hash to the same rate-limit/Redis key instead of two different ones. Node's
 * own dual-stack sockets commonly report IPv4 clients as `::ffff:`-prefixed (affecting
 * req.ip), and hex casing can vary innocuously across providers.
 *
 * Not full RFC 5952 canonicalization -- doesn't collapse zero-run compression/
 * expansion differences (e.g. `2001:db8:0:0::1` vs `2001:db8::1`). Covers the specific
 * equivalence class actually likely to show up here, not the general case.
 */
export function normalizeIp(ip: string): string {
  if (/^::ffff:/i.test(ip)) {
    const v4 = ip.slice('::ffff:'.length);
    if (net.isIPv4(v4)) return v4;
  }

  return net.isIPv6(ip) ? ip.toLowerCase() : ip;
}
