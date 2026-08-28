import { Request } from 'express';
import { IpResolutionStrategy } from '../ip-resolution-strategy.interface';

/**
 * Trusts Cloudflare's `CF-Connecting-IP` header. This is safe to trust only because the
 * origin is unreachable except through Cloudflare (mTLS / Authenticated Origin Pulls
 * enforced between Cloudflare and the ingress, configured separately in infra). That
 * network-level lockdown is what actually makes this header trustworthy; nothing here
 * verifies it's in place.
 */
export class CloudflareIpStrategy implements IpResolutionStrategy {
  readonly name = 'cloudflare';

  resolve(req: Request): string | null {
    const header = req.headers['cf-connecting-ip'];
    const value = (Array.isArray(header) ? header[0] : header)?.trim();
    return value ? value : null;
  }
}
