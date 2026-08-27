import { Request } from 'express';

/**
 * Resolves a client IP from a request using one edge/CDN provider's convention (e.g. a
 * specific header). Implementations must never throw and must never guess: if the
 * expected signal isn't present or is malformed, return null and let the caller
 * (IpResolverService) decide the fallback. Validating that the result is actually a
 * well-formed IP is also the caller's job, not the strategy's -- keeps that logic in
 * one place instead of duplicated per strategy.
 */
export interface IpResolutionStrategy {
  readonly name: string;
  resolve(req: Request): string | null;
}
