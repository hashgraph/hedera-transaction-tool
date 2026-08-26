import { normalizeIp } from './normalize-ip';

/**
 * True if `ip` is a private/loopback/link-local address -- the kind used for traffic
 * that never passes through the public edge: Kubernetes health probes, other in-cluster
 * callers, direct connections in local dev. Deliberately the same scope as the
 * 'loopback' | 'linklocal' | 'uniquelocal' presets already trusted for Express's `trust
 * proxy` setting in main.ts, so "internal" means the same thing in both places.
 *
 * Takes a single already-resolved address, not a raw header value -- it doesn't parse
 * or pick an entry out of a comma-separated chain. The one caller (IpResolverService)
 * passes req.ip, which Express has already resolved to one address.
 *
 * Not exhaustive CIDR math -- this is a heuristic for deciding whether a missing
 * trust-provider header is expected, not a security boundary.
 */
export function isInternalAddress(ip: string): boolean {
  const v4 = normalizeIp(ip);

  return (
    v4 === '::1' ||
    /^127\./.test(v4) || // loopback, 127.0.0.0/8 -- not just 127.0.0.1
    /^10\./.test(v4) ||
    /^192\.168\./.test(v4) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v4) ||
    /^169\.254\./.test(v4) ||
    /^f[cd][0-9a-f]{2}:/i.test(v4) || // unique local, fc00::/7
    /^fe[89ab][0-9a-f]:/i.test(v4) // link-local, fe80::/10
  );
}
