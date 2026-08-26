import * as net from 'net';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { IpResolutionStrategy } from './ip-resolution-strategy.interface';
import { isInternalAddress } from './internal-address';
import { normalizeIp } from './normalize-ip';
import { CloudflareIpStrategy } from './strategies/cloudflare.strategy';

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

    if (resolved && net.isIP(resolved)) {
      return normalizeIp(resolved);
    }

    const fallback = normalizeIp(req.ip || '0.0.0.0');
    const where = `${req.method} ${req.originalUrl}`;

    if (resolved) {
      // Header was present but not a valid IP -- worth flagging regardless of where
      // the request came from, since nothing legitimate should ever send a malformed
      // value.
      this.logger.warn(
        `Strategy "${this.strategy.name}" resolved a malformed IP ("${resolved}") for ${where}; falling back to req.ip (${fallback})`,
      );
    } else if (!isInternalAddress(fallback)) {
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
}
