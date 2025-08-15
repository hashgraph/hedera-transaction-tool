import { CommonNetwork } from '@shared/enums';
import { parseNetwork } from '@main/utils/parsers';

describe('parseNetwork', () => {
  test('should return TESTNET for testnet value', () => {
    const result = parseNetwork('testnet', CommonNetwork.MAINNET);
    expect(result).toBe(CommonNetwork.TESTNET);
  });

  test('should return MAINNET for mainnet value', () => {
    const result = parseNetwork('mainnet', CommonNetwork.TESTNET);
    expect(result).toBe(CommonNetwork.MAINNET);
  });

  test('should return PREVIEWNET for previewnet value', () => {
    const result = parseNetwork('previewnet', CommonNetwork.MAINNET);
    expect(result).toBe(CommonNetwork.PREVIEWNET);
  });

  test('should return default network for unknown value', () => {
    const result = parseNetwork('unknown', CommonNetwork.MAINNET);
    expect(result).toBe(CommonNetwork.MAINNET);
  });

  test('should handle case insensitivity', () => {
    const result = parseNetwork('TeStNeT', CommonNetwork.MAINNET);
    expect(result).toBe(CommonNetwork.TESTNET);
  });

  test('should return default network for empty string', () => {
    const result = parseNetwork('', CommonNetwork.MAINNET);
    expect(result).toBe(CommonNetwork.MAINNET);
  });

  test('should return default network for null value', () => {
    const result = parseNetwork(null as unknown as string, CommonNetwork.MAINNET);
    expect(result).toBe(CommonNetwork.MAINNET);
  });

  test('should return default network for undefined value', () => {
    const result = parseNetwork(undefined as unknown as string, CommonNetwork.MAINNET);
    expect(result).toBe(CommonNetwork.MAINNET);
  });
});
