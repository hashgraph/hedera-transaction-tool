import * as ipaddr from 'ipaddr.js';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { IpResolutionStrategy } from './ip-resolution-strategy.interface';
import { CloudflareIpStrategy } from './strategies/cloudflare.strategy';

// ipaddr.js splits what Express's 'trust proxy' presets call 'uniquelocal' into two
// range names: 'private' (RFC 1918 IPv4) and 'uniqueLocal' (IPv6 ULA, fc00::/7). Same
// address space, just named differently on each side.
const INTERNAL_RANGES: ReadonlySet<string> = new Set(['loopback', 'private', 'linkLocal', 'uniqueLocal']);

/**
 * Single source of truth for "the client's real IP". Every consumer -- rate limiters,
 * audit logs, geolocation, etc -- should go through this service (or the @ClientIp()
 * decorator it backs), never read a raw header directly. Switching edge/CDN providers
 * is a config change (IP_TRUST_PROVIDER) plus, if needed, a new strategy class -- not a
 * rewrite scattered across the codebase.
 *
 * Never throws: worst case, resolve() falls back to req.ip, and worst case beyond that,
 * '0.0.0.0'.
 */
@Injectable()
export class IpResolverService {
  private readonly logger = new Logger(IpResolverService.name);
  private readonly strategy: IpResolutionStrategy;

  constructor(configService: ConfigService) {
    const provider = configService.get('IP_TRUST_PROVIDER', 'cloudflare');

    switch (provider) {
      // Add a case here (and a new strategy class implementing IpResolutionStrategy)
      // when a second provider is actually needed -- not before.
      case 'cloudflare':
      default:
        this.strategy = new CloudflareIpStrategy();
        break;
    }
  }

  resolve(req: Request): string {
    const resolved = this.strategy.resolve(req);

    if (resolved && ipaddr.isValid(resolved)) {
      return this.canonicalize(resolved);
    }

    const fallback = this.canonicalize(req.ip || '0.0.0.0');
    const where = `${req.method} ${req.originalUrl}`;

    if (resolved) {
      // Header was present but not a valid IP -- worth flagging regardless of where
      // the request came from, since nothing legitimate should ever send a malformed
      // value.
      this.logger.warn(
        `Strategy "${this.strategy.name}" resolved a malformed IP ("${resolved}") for ${where}; falling back to req.ip (${fallback})`,
      );
    } else if (!this.isInternal(fallback)) {
      // Header was simply absent. Traffic that never passes through the edge --
      // health checks, other in-cluster callers -- always arrives from a private
      // address and is expected to be missing it; only warn when the connecting
      // address looks external, since that's the case actually worth investigating.
      this.logger.warn(
        `Strategy "${this.strategy.name}" could not resolve a client IP for ${where}; falling back to req.ip (${fallback})`,
      );
    }

    return fallback;
  }

  // Canonicalizes via ipaddr.js (collapses IPv4-mapped IPv6, fully normalizes IPv6 per
  // RFC 5952) so different representations of the same address produce the same
  // rate-limit/Redis key. Guards its own input rather than trusting the caller already
  // validated it -- req.ip is expected to always be valid, but this is the one thing
  // standing between that assumption and resolve()'s "never throws" guarantee.
  private canonicalize(ip: string): string {
    return ipaddr.isValid(ip) ? ipaddr.process(ip).toString() : ip;
  }

  // True for a private/loopback/link-local address -- the kind used for traffic that
  // never passes through the public edge: Kubernetes health probes, other in-cluster
  // callers, direct connections in local dev. Deliberately the same scope as the
  // 'loopback' | 'linklocal' | 'uniquelocal' presets already trusted for Express's
  // `trust proxy` setting in main.ts, so "internal" means the same thing in both
  // places. A heuristic for deciding whether a missing header is expected, not a
  // security boundary.
  private isInternal(ip: string): boolean {
    return ipaddr.isValid(ip) && INTERNAL_RANGES.has(ipaddr.process(ip).range());
  }
}
