import { beforeEach, describe, expect, test, vi } from 'vitest';
import axios from 'axios';

import { CommonNetwork } from '@shared/enums';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('@renderer/utils/logger', () => ({ createLogger: () => mockLogger }));
vi.mock('axios', async importOriginal => {
  const actual = await importOriginal<typeof import('axios')>();
  return { default: { ...actual.default, get: vi.fn() } };
});

import { getVerifiedContract, isSourcifySupported } from '@renderer/services/sourcifyService';

describe('sourcifyService', () => {
  const addr = '0xabc';

  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    mockLogger.warn.mockReset();
  });

  test('isSourcifySupported is true only for Hedera public networks', () => {
    expect(isSourcifySupported(CommonNetwork.MAINNET)).toBe(true);
    expect(isSourcifySupported(CommonNetwork.TESTNET)).toBe(true);
    expect(isSourcifySupported(CommonNetwork.PREVIEWNET)).toBe(true);
    expect(isSourcifySupported(CommonNetwork.LOCAL_NODE)).toBe(false);
    expect(isSourcifySupported('https://custom')).toBe(false);
  });

  test.each([
    [CommonNetwork.MAINNET, 295],
    [CommonNetwork.TESTNET, 296],
    [CommonNetwork.PREVIEWNET, 297],
  ])('queries the right chain id for %s', async (network, chainId) => {
    vi.mocked(axios.get).mockResolvedValue({ data: { abi: [] } });
    const controller = new AbortController();

    await getVerifiedContract(network, addr, controller);

    expect(axios.get).toHaveBeenCalledWith(
      `https://sourcify.dev/server/v2/contract/${chainId}/${addr}`,
      { params: { fields: 'abi,sources,compilation' }, signal: controller.signal },
    );
  });

  test('returns null without a request for unsupported networks', async () => {
    expect(await getVerifiedContract(CommonNetwork.LOCAL_NODE, addr)).toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('maps the response, stripping the project:/ prefix from source paths', async () => {
    const abi = [{ type: 'function', name: 'f' }];
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        abi,
        match: 'exact_match',
        compilation: { name: 'Token' },
        sources: {
          'project:/contracts/A.sol': { content: 'a' },
          'lib/B.sol': { content: 'b' },
        },
      },
    });

    expect(await getVerifiedContract(CommonNetwork.TESTNET, addr)).toEqual({
      name: 'Token',
      match: 'exact_match',
      abi,
      sources: [
        { path: 'contracts/A.sol', content: 'a' },
        { path: 'lib/B.sol', content: 'b' },
      ],
    });
    expect(vi.mocked(axios.get).mock.calls[0][1]?.signal).toBeUndefined();
  });

  test('defaults name and sources when absent', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { abi: [], match: 'match' } });
    expect(await getVerifiedContract(CommonNetwork.TESTNET, addr)).toEqual({
      name: '',
      match: 'match',
      abi: [],
      sources: [],
    });
  });

  test('returns null when the response has no abi array', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { abi: null } });
    expect(await getVerifiedContract(CommonNetwork.TESTNET, addr)).toBeNull();
  });

  test('returns null silently on 404 (not verified)', async () => {
    const err = new axios.AxiosError('nf', '404', undefined, undefined, {
      status: 404,
    } as never);
    vi.mocked(axios.get).mockRejectedValue(err);
    expect(await getVerifiedContract(CommonNetwork.TESTNET, addr)).toBeNull();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('returns null silently when the request is cancelled', async () => {
    vi.mocked(axios.get).mockRejectedValue(new axios.CanceledError('cancelled'));
    expect(await getVerifiedContract(CommonNetwork.TESTNET, addr)).toBeNull();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test.each([
    ['server error', new axios.AxiosError('x', '500', undefined, undefined, { status: 500 } as never)],
    ['network failure', new Error('offline')],
  ])('returns null and warns on %s so an outage never blocks the caller', async (_n, err) => {
    vi.mocked(axios.get).mockRejectedValue(err);
    expect(await getVerifiedContract(CommonNetwork.TESTNET, addr)).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
