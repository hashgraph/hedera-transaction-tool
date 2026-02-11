export const VALID_IPV4_REGEX =
  '^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]).){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$';

export function stripProtocolAndPath(input: string): string {
  let result = input.trim();

  // Remove protocol prefix (http://, https://, grpc://, etc.)
  result = result.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');

  // Remove path, query parameters, and fragments
  // Find the first occurrence of /, ?, or # and truncate there
  const slashIndex = result.indexOf('/');
  const queryIndex = result.indexOf('?');
  const fragmentIndex = result.indexOf('#');

  const indices = [slashIndex, queryIndex, fragmentIndex].filter(i => i !== -1);
  if (indices.length > 0) {
    const cutIndex = Math.min(...indices);
    result = result.substring(0, cutIndex);
  }

  return result;
}

export function cleanAndExtractPort(input: string): { hostPart: string; port: string | null } {
  let hostPart = stripProtocolAndPath(input);

  const colonCount = (hostPart.match(/:/g) || []).length;

  if (colonCount > 1) {
    // IPv6 territory - only extract port if brackets are used: [IPv6]:port
    const bracketMatch = hostPart.match(/^(\[.+\]):(\d+)$/);
    if (bracketMatch) {
      return { hostPart: bracketMatch[1], port: bracketMatch[2] };
    }
    // Bare IPv6 - can't have a port without brackets
    return { hostPart, port: null };
  }

  // IPv4 or domain - standard port extraction
  const portMatch = hostPart.match(/:(\d+)$/);
  if (portMatch) {
    const port = portMatch[1];
    hostPart = hostPart.substring(0, hostPart.lastIndexOf(':'));
    return { hostPart, port };
  }

  return { hostPart, port: null };
}

export function processEndpointInput(
  ipOrDomain: string,
  currentPort: string,
): { ipOrDomain: string; port: string } {
  const { hostPart, port } = cleanAndExtractPort(ipOrDomain);
  return {
    ipOrDomain: hostPart,
    port: port ?? currentPort,
  };
}

export function isValidFqdn(domain: string): boolean {
  const trimmed = domain.trim();

  if (!trimmed) return false;

  // Reject IPv4 addresses
  if (trimmed.match(VALID_IPV4_REGEX)) return false;

  // Must contain at least one dot (fully qualified)
  if (!trimmed.includes('.')) return false;

  // Total length <= 253 characters
  if (trimmed.length > 253) return false;

  // Strip optional trailing dot (valid FQDN representation)
  const normalized = trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;

  const labels = normalized.split('.');

  for (const label of labels) {
    // Each label must be 1-63 characters
    if (label.length === 0 || label.length > 63) return false;

    // Each label must contain only alphanumeric characters and hyphens
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return false;

    // Labels must not start or end with a hyphen
    if (label.startsWith('-') || label.endsWith('-')) return false;
  }

  return true;
}

export function getEndpointData(ipOrDomain: string, port: string) {
  // Input already cleaned by watcher - just classify as IP or domain
  const isIp = ipOrDomain.match(VALID_IPV4_REGEX);

  return {
    ipAddressV4: isIp ? ipOrDomain : '',
    port,
    domainName: isIp ? '' : ipOrDomain.trim(),
  };
}
