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
 * Never throws: worst case, resolve() falls back to req.ip, and worst case beyond that
 * (req.ip missing or, despite Express's own contract, not actually valid), '0.0.0.0'.
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
      return ipaddr.process(resolved).toString();
    }

    const { value: fallback, internal } = this.resolveFallback(req.ip);
    const where = `${req.method} ${req.originalUrl}`;

    if (resolved) {
      // Header was present but not a valid IP -- worth flagging regardless of where
      // the request came from, since nothing legitimate should ever send a malformed
      // value.
      this.logger.warn(
        `Strategy "${this.strategy.name}" resolved a malformed IP ("${resolved}") for ${where}; falling back to req.ip (${fallback})`,
      );
    } else if (!internal) {
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

  // Canonicalizes req.ip (collapses IPv4-mapped IPv6, fully normalizes IPv6 per RFC
  // 5952) and classifies whether it's a private/loopback/link-local address --
  // deliberately the same scope as the 'loopback' | 'linklocal' | 'uniquelocal'
  // presets already trusted for Express's `trust proxy` setting in main.ts, so
  // "internal" means the same thing in both places. Both come from a single ipaddr.js
  // parse rather than two separate validity checks.
  //
  // Falls back to '0.0.0.0' (never internal, so it always warns) if req.ip is missing
  // or, despite Express's own contract, not actually valid -- an arbitrary unvalidated
  // string must never become part of a Redis key. Never throws.
  private resolveFallback(ip: string | undefined): { value: string; internal: boolean } {
    if (!ip || !ipaddr.isValid(ip)) {
      return { value: '0.0.0.0', internal: false };
    }

    const parsed = ipaddr.process(ip);
    return { value: parsed.toString(), internal: INTERNAL_RANGES.has(parsed.range()) };
  }
}
