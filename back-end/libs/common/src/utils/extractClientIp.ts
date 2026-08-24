/**
 * Extracts the real client IP from a request.
 *
 * Resolution order:
 * 1. CF-Connecting-IP — set by Cloudflare; not client-controllable.
 * 2. X-Forwarded-For  — first (leftmost) value, which is the original client
 *                       IP appended by the first proxy in the chain.
 * 3. req.ip           — Express fallback (direct connection address).
 *
 * Note: X-Forwarded-For is client-controllable when no trusted proxy is
 * configured. CF-Connecting-IP takes precedence precisely because Cloudflare
 * strips and rewrites it, making it safe to trust.
 */
export function extractClientIp(req: Record<string, any>): string | undefined {
  const cf = req.headers?.['cf-connecting-ip'];
  if (cf && typeof cf === 'string' && cf.trim()) {
    return cf.trim();
  }

  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }

  return req.ip;
}
