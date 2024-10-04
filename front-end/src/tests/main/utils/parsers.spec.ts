import { Network } from '@main/shared/enums';
import { parseNetwork } from '@main/utils/parsers';

describe('parseNetwork', () => {
  test('should return TESTNET for testnet value', () => {
    const result = parseNetwork('testnet', Network.MAINNET);
    expect(result).toBe(Network.TESTNET);
  });

  test('should return MAINNET for mainnet value', () => {
    const result = parseNetwork('mainnet', Network.TESTNET);
    expect(result).toBe(Network.MAINNET);
  });

  test('should return PREVIEWNET for previewnet value', () => {
    const result = parseNetwork('previewnet', Network.MAINNET);
    expect(result).toBe(Network.PREVIEWNET);
  });

  test('should return default network for unknown value', () => {
    const result = parseNetwork('unknown', Network.MAINNET);
    expect(result).toBe(Network.MAINNET);
  });

  test('should handle case insensitivity', () => {
    const result = parseNetwork('TeStNeT', Network.MAINNET);
    expect(result).toBe(Network.TESTNET);
  });

  test('should return default network for empty string', () => {
    const result = parseNetwork('', Network.MAINNET);
    expect(result).toBe(Network.MAINNET);
  });

  test('should return default network for null value', () => {
    const result = parseNetwork(null as unknown as string, Network.MAINNET);
    expect(result).toBe(Network.MAINNET);
  });

  test('should return default network for undefined value', () => {
    const result = parseNetwork(undefined as unknown as string, Network.MAINNET);
    expect(result).toBe(Network.MAINNET);
  });
});
