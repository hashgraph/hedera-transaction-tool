import { expect } from 'vitest';
import {
  stripProtocolAndPath,
  cleanAndExtractPort,
  getEndpointData,
  isValidFqdn,
  processEndpointInput,
} from '@renderer/utils/endpointUtils';

describe('stripProtocolAndPath', () => {
  describe('protocol removal', () => {
    test('should remove http:// protocol', () => {
      expect(stripProtocolAndPath('http://example.com')).toBe('example.com');
    });

    test('should remove https:// protocol', () => {
      expect(stripProtocolAndPath('https://example.com')).toBe('example.com');
    });

    test('should remove grpc:// protocol', () => {
      expect(stripProtocolAndPath('grpc://node.hedera.com')).toBe('node.hedera.com');
    });

    test('should remove ftp:// protocol', () => {
      expect(stripProtocolAndPath('ftp://files.example.com')).toBe('files.example.com');
    });

    test('should remove grpcs:// protocol', () => {
      expect(stripProtocolAndPath('grpcs://secure.node.com')).toBe('secure.node.com');
    });

    test('should remove custom protocol with special chars', () => {
      expect(stripProtocolAndPath('myproto+secure.2://host.io')).toBe('host.io');
    });

    test('should not remove protocol-like text without ://', () => {
      expect(stripProtocolAndPath('http:example.com')).toBe('http:example.com');
    });

    test('should not remove :// when prefix starts with a digit but still strips path', () => {
      // Protocol regex doesn't match (digit prefix), but // is truncated as a path separator
      expect(stripProtocolAndPath('123://example.com')).toBe('123:');
    });
  });

  describe('path, query, and fragment removal', () => {
    test('should remove trailing path', () => {
      expect(stripProtocolAndPath('example.com/some/path')).toBe('example.com');
    });

    test('should remove query parameters', () => {
      expect(stripProtocolAndPath('example.com?key=value')).toBe('example.com');
    });

    test('should remove fragment', () => {
      expect(stripProtocolAndPath('example.com#section')).toBe('example.com');
    });

    test('should remove path with query and fragment combined', () => {
      expect(stripProtocolAndPath('example.com/path?q=1#frag')).toBe('example.com');
    });

    test('should remove protocol and path together', () => {
      expect(stripProtocolAndPath('https://example.com/api/v1')).toBe('example.com');
    });

    test('should remove protocol, path, query, and fragment together', () => {
      expect(stripProtocolAndPath('https://example.com/path?q=1#frag')).toBe('example.com');
    });

    test('should truncate at / when it appears before ? and #', () => {
      expect(stripProtocolAndPath('host.com/path?q#f')).toBe('host.com');
    });

    test('should truncate at ? when it appears before /', () => {
      expect(stripProtocolAndPath('host.com?q/path')).toBe('host.com');
    });

    test('should truncate at # when it appears before /', () => {
      expect(stripProtocolAndPath('host.com#frag/path')).toBe('host.com');
    });
  });

  describe('edge cases', () => {
    test('should return empty string for empty input', () => {
      expect(stripProtocolAndPath('')).toBe('');
    });

    test('should trim leading and trailing whitespace', () => {
      expect(stripProtocolAndPath('  example.com  ')).toBe('example.com');
    });

    test('should return empty string for whitespace-only input', () => {
      expect(stripProtocolAndPath('   ')).toBe('');
    });

    test('should return host:port unchanged when no path is present', () => {
      expect(stripProtocolAndPath('example.com:8080')).toBe('example.com:8080');
    });

    test('should handle bare IP address without protocol', () => {
      expect(stripProtocolAndPath('192.168.1.1')).toBe('192.168.1.1');
    });

    test('should handle IP address with protocol, port, and path', () => {
      expect(stripProtocolAndPath('http://192.168.1.1:8080/path')).toBe('192.168.1.1:8080');
    });

    test('should handle IPv6 bracket notation with protocol and path', () => {
      expect(stripProtocolAndPath('http://[::1]:8080/path')).toBe('[::1]:8080');
    });

    test('should handle trailing slash only', () => {
      expect(stripProtocolAndPath('host.com/')).toBe('host.com');
    });

    test('should return empty string for protocol-only input', () => {
      expect(stripProtocolAndPath('http://')).toBe('');
    });

    test('should preserve port when stripping protocol and path', () => {
      expect(stripProtocolAndPath('https://node.hedera.com:50211/api')).toBe(
        'node.hedera.com:50211',
      );
    });
  });
});

describe('cleanAndExtractPort', () => {
  describe('IPv4 addresses', () => {
    test('should return IPv4 without port when no port present', () => {
      expect(cleanAndExtractPort('192.168.1.1')).toEqual({
        hostPart: '192.168.1.1',
        port: null,
      });
    });

    test('should extract port from IPv4:port', () => {
      expect(cleanAndExtractPort('192.168.1.1:8080')).toEqual({
        hostPart: '192.168.1.1',
        port: '8080',
      });
    });

    test('should strip protocol before extracting port from IPv4', () => {
      expect(cleanAndExtractPort('http://10.0.0.1:3000')).toEqual({
        hostPart: '10.0.0.1',
        port: '3000',
      });
    });

    test('should strip protocol and path before extracting port from IPv4', () => {
      expect(cleanAndExtractPort('https://10.0.0.1:50211/api')).toEqual({
        hostPart: '10.0.0.1',
        port: '50211',
      });
    });
  });

  describe('domain names', () => {
    test('should return domain without port when no port present', () => {
      expect(cleanAndExtractPort('node.hedera.com')).toEqual({
        hostPart: 'node.hedera.com',
        port: null,
      });
    });

    test('should extract port from domain:port', () => {
      expect(cleanAndExtractPort('node.hedera.com:50211')).toEqual({
        hostPart: 'node.hedera.com',
        port: '50211',
      });
    });

    test('should strip protocol before extracting port from domain', () => {
      expect(cleanAndExtractPort('https://node.hedera.com:443')).toEqual({
        hostPart: 'node.hedera.com',
        port: '443',
      });
    });

    test('should strip protocol and path before extracting port from domain', () => {
      expect(cleanAndExtractPort('grpc://node.hedera.com:50211/grpc')).toEqual({
        hostPart: 'node.hedera.com',
        port: '50211',
      });
    });
  });

  describe('bare IPv6 (no brackets)', () => {
    test('should return bare IPv6 with null port for full address', () => {
      expect(cleanAndExtractPort('2001:db8::1')).toEqual({
        hostPart: '2001:db8::1',
        port: null,
      });
    });

    test('should return bare IPv6 loopback with null port', () => {
      expect(cleanAndExtractPort('::1')).toEqual({
        hostPart: '::1',
        port: null,
      });
    });

    test('should strip protocol from bare IPv6', () => {
      expect(cleanAndExtractPort('http://2001:db8::1')).toEqual({
        hostPart: '2001:db8::1',
        port: null,
      });
    });

    test('should handle bare IPv6 with many colon-separated groups', () => {
      expect(cleanAndExtractPort('fe80:0:0:0:0:0:0:1')).toEqual({
        hostPart: 'fe80:0:0:0:0:0:0:1',
        port: null,
      });
    });
  });

  describe('bracketed IPv6', () => {
    test('should return bracketed IPv6 with null port when no port suffix', () => {
      expect(cleanAndExtractPort('[2001:db8::1]')).toEqual({
        hostPart: '[2001:db8::1]',
        port: null,
      });
    });

    test('should extract port from [IPv6]:port notation', () => {
      expect(cleanAndExtractPort('[2001:db8::1]:8080')).toEqual({
        hostPart: '[2001:db8::1]',
        port: '8080',
      });
    });

    test('should extract port from [::1]:port notation', () => {
      expect(cleanAndExtractPort('[::1]:50211')).toEqual({
        hostPart: '[::1]',
        port: '50211',
      });
    });

    test('should strip protocol before extracting port from bracketed IPv6', () => {
      expect(cleanAndExtractPort('http://[::1]:8080')).toEqual({
        hostPart: '[::1]',
        port: '8080',
      });
    });
  });

  describe('edge cases', () => {
    test('should return empty hostPart and null port for empty string', () => {
      expect(cleanAndExtractPort('')).toEqual({ hostPart: '', port: null });
    });

    test('should return empty hostPart and null port for whitespace-only input', () => {
      expect(cleanAndExtractPort('  ')).toEqual({ hostPart: '', port: null });
    });

    test('should not extract port when colon has no trailing digits', () => {
      expect(cleanAndExtractPort('example.com:')).toEqual({
        hostPart: 'example.com:',
        port: null,
      });
    });

    test('should handle full URL with protocol, port, path, and query', () => {
      expect(cleanAndExtractPort('https://host.com:9090/path?q=1')).toEqual({
        hostPart: 'host.com',
        port: '9090',
      });
    });

    test('should handle single-character hostname with port', () => {
      expect(cleanAndExtractPort('a:8080')).toEqual({
        hostPart: 'a',
        port: '8080',
      });
    });
  });
});

describe('processEndpointInput', () => {
  test('should strip protocol and extract port from full URL', () => {
    expect(processEndpointInput('https://example.com:8080/path', '3000')).toEqual({
      ipOrDomain: 'example.com',
      port: '8080',
    });
  });

  test('should preserve currentPort when input has no port', () => {
    expect(processEndpointInput('example.com', '5000')).toEqual({
      ipOrDomain: 'example.com',
      port: '5000',
    });
  });

  test('should strip protocol only when no port in input', () => {
    expect(processEndpointInput('https://node.hedera.com', '50211')).toEqual({
      ipOrDomain: 'node.hedera.com',
      port: '50211',
    });
  });

  test('should return empty host and preserve currentPort for empty input', () => {
    expect(processEndpointInput('', '8080')).toEqual({
      ipOrDomain: '',
      port: '8080',
    });
  });
});

describe('isValidFqdn', () => {
  describe('valid FQDNs', () => {
    test('should accept standard FQDN', () => {
      expect(isValidFqdn('proxy.hedera.com')).toBe(true);
    });

    test('should accept two-label FQDN', () => {
      expect(isValidFqdn('example.com')).toBe(true);
    });

    test('should accept multi-level subdomain', () => {
      expect(isValidFqdn('api.staging.hedera.io')).toBe(true);
    });

    test('should accept short labels', () => {
      expect(isValidFqdn('a.b.c')).toBe(true);
    });

    test('should accept hyphens within labels', () => {
      expect(isValidFqdn('my-host.example.io')).toBe(true);
    });

    test('should accept trailing dot (absolute FQDN)', () => {
      expect(isValidFqdn('proxy.hedera.com.')).toBe(true);
    });

    test('should accept labels with digits', () => {
      expect(isValidFqdn('node1.hedera2.com')).toBe(true);
    });

    test('should trim whitespace and accept valid FQDN', () => {
      expect(isValidFqdn('  proxy.hedera.com  ')).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    test('should reject empty string', () => {
      expect(isValidFqdn('')).toBe(false);
    });

    test('should reject whitespace-only string', () => {
      expect(isValidFqdn('   ')).toBe(false);
    });

    test('should reject IPv4 address', () => {
      expect(isValidFqdn('192.168.1.1')).toBe(false);
    });

    test('should reject single label without dot (e.g. localhost)', () => {
      expect(isValidFqdn('localhost')).toBe(false);
    });

    test('should reject label starting with hyphen', () => {
      expect(isValidFqdn('-bad.com')).toBe(false);
    });

    test('should reject label ending with hyphen', () => {
      expect(isValidFqdn('bad-.com')).toBe(false);
    });

    test('should reject label with underscores', () => {
      expect(isValidFqdn('my_host.com')).toBe(false);
    });

    test('should reject label with spaces', () => {
      expect(isValidFqdn('my host.com')).toBe(false);
    });

    test('should reject domain exceeding 253 characters', () => {
      const longDomain = 'a'.repeat(62) + '.' + 'b'.repeat(62) + '.' + 'c'.repeat(62) + '.' + 'd'.repeat(63) + '.com';
      expect(longDomain.length).toBeGreaterThan(253);
      expect(isValidFqdn(longDomain)).toBe(false);
    });

    test('should reject label exceeding 63 characters', () => {
      const longLabel = 'a'.repeat(64) + '.com';
      expect(isValidFqdn(longLabel)).toBe(false);
    });

    test('should reject empty label (consecutive dots)', () => {
      expect(isValidFqdn('proxy..hedera.com')).toBe(false);
    });
  });
});

describe('getEndpointData', () => {
  describe('valid IPv4 addresses', () => {
    test('should classify standard IPv4 as IP', () => {
      expect(getEndpointData('192.168.1.1', '8080')).toEqual({
        ipAddressV4: '192.168.1.1',
        port: '8080',
        domainName: '',
      });
    });

    test('should classify loopback 127.0.0.1 as IP', () => {
      expect(getEndpointData('127.0.0.1', '50211')).toEqual({
        ipAddressV4: '127.0.0.1',
        port: '50211',
        domainName: '',
      });
    });

    test('should classify 0.0.0.0 as IP', () => {
      expect(getEndpointData('0.0.0.0', '80')).toEqual({
        ipAddressV4: '0.0.0.0',
        port: '80',
        domainName: '',
      });
    });

    test('should classify 255.255.255.255 as IP', () => {
      expect(getEndpointData('255.255.255.255', '443')).toEqual({
        ipAddressV4: '255.255.255.255',
        port: '443',
        domainName: '',
      });
    });
  });

  describe('domain names', () => {
    test('should classify FQDN as domain', () => {
      expect(getEndpointData('node.hedera.com', '50211')).toEqual({
        ipAddressV4: '',
        port: '50211',
        domainName: 'node.hedera.com',
      });
    });

    test('should classify simple hostname as domain', () => {
      expect(getEndpointData('localhost', '8080')).toEqual({
        ipAddressV4: '',
        port: '8080',
        domainName: 'localhost',
      });
    });

    test('should classify multi-level subdomain as domain', () => {
      expect(getEndpointData('api.staging.hedera.io', '443')).toEqual({
        ipAddressV4: '',
        port: '443',
        domainName: 'api.staging.hedera.io',
      });
    });
  });

  describe('edge cases', () => {
    test('should trim whitespace from domain input', () => {
      expect(getEndpointData('  node.hedera.com  ', '50211')).toEqual({
        ipAddressV4: '',
        port: '50211',
        domainName: 'node.hedera.com',
      });
    });

    test('should classify out-of-range octet (256) as domain', () => {
      expect(getEndpointData('256.1.1.1', '80')).toEqual({
        ipAddressV4: '',
        port: '80',
        domainName: '256.1.1.1',
      });
    });

    test('should classify partial IP (three octets) as IP due to unescaped dot in regex', () => {
      // The validIp regex uses unescaped dots which match any character,
      // allowing backtracking to match "192.168.1" as a valid IP pattern
      expect(getEndpointData('192.168.1', '80')).toEqual({
        ipAddressV4: '192.168.1',
        port: '80',
        domainName: '',
      });
    });

    test('should pass port value through unchanged', () => {
      expect(getEndpointData('example.com', '50211')).toEqual({
        ipAddressV4: '',
        port: '50211',
        domainName: 'example.com',
      });
    });

    test('should handle empty ipOrDomain', () => {
      expect(getEndpointData('', '8080')).toEqual({
        ipAddressV4: '',
        port: '8080',
        domainName: '',
      });
    });

    test('should classify bracketed IPv6 as domain (not IPv4)', () => {
      expect(getEndpointData('[::1]', '8080')).toEqual({
        ipAddressV4: '',
        port: '8080',
        domainName: '[::1]',
      });
    });
  });
});
