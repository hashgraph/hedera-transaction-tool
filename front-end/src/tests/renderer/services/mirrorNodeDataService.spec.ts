// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from 'vitest';

const { axiosGet, axiosPost } = vi.hoisted(() => ({ axiosGet: vi.fn(), axiosPost: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    get: axiosGet,
    post: axiosPost,
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean })?.isAxiosError),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

vi.mock('@renderer/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { callContract, getContractInfo, getNodeInfo } from '@renderer/services/mirrorNodeDataService';

// A minimal node payload from the mirror node — only the fields getNodeInfo
// reads explicitly. Any field this test doesn't override is null so the parser
// hits its fallback branches.
function nodePayload(overrides: Record<string, unknown> = {}) {
  return {
    admin_key: null,
    description: null,
    file_id: null,
    memo: null,
    node_id: 3,
    node_account_id: '0.0.3',
    node_cert_hash: null,
    public_key: null,
    service_endpoints: [],
    timestamp: null,
    max_stake: null,
    min_stake: null,
    stake: null,
    stake_not_rewarded: null,
    stake_rewarded: null,
    staking_period: null,
    reward_rate_start: null,
    decline_reward: false,
    grpc_proxy_endpoint: null,
    ...overrides,
  };
}

function mockNodesResponse(node: Record<string, unknown>) {
  axiosGet.mockResolvedValueOnce({ data: { nodes: [node] } });
}

describe('mirrorNodeDataService.getNodeInfo — associated_registered_nodes', () => {
  beforeEach(() => {
    axiosGet.mockReset();
  });

  test('defaults to [] when the mirror response omits the field', async () => {
    mockNodesResponse(nodePayload()); // no associated_registered_nodes key
    const info = await getNodeInfo(3, 'https://mirror.example');
    expect(info?.associated_registered_nodes).toEqual([]);
  });

  test('passes a numeric array through unchanged', async () => {
    mockNodesResponse(nodePayload({ associated_registered_nodes: [1, 7, 12] }));
    const info = await getNodeInfo(3, 'https://mirror.example');
    expect(info?.associated_registered_nodes).toEqual([1, 7, 12]);
  });

  test('treats explicit null as []', async () => {
    mockNodesResponse(nodePayload({ associated_registered_nodes: null }));
    const info = await getNodeInfo(3, 'https://mirror.example');
    expect(info?.associated_registered_nodes).toEqual([]);
  });

  test('treats explicit empty array as []', async () => {
    mockNodesResponse(nodePayload({ associated_registered_nodes: [] }));
    const info = await getNodeInfo(3, 'https://mirror.example');
    expect(info?.associated_registered_nodes).toEqual([]);
  });
});

const axiosError = (status?: number, data?: unknown) =>
  Object.assign(new Error('axios'), {
    isAxiosError: true,
    response: status === undefined ? undefined : { status, data },
  });

describe('mirrorNodeDataService.getContractInfo', () => {
  beforeEach(() => {
    axiosGet.mockReset();
  });

  test('maps the response and hits /contracts/{id}', async () => {
    axiosGet.mockResolvedValueOnce({
      data: { contract_id: '0.0.5', evm_address: '0xabc', deleted: false, extra: 1 },
    });
    const controller = new AbortController();
    const info = await getContractInfo('0.0.5', 'https://mirror.example', controller);
    expect(info).toEqual({ contract_id: '0.0.5', evm_address: '0xabc', deleted: false });
    expect(axiosGet).toHaveBeenCalledWith(expect.stringMatching(/\/contracts\/0\.0\.5$/), {
      signal: controller.signal,
    });
  });

  test('coerces deleted to boolean and works without a controller', async () => {
    axiosGet.mockResolvedValueOnce({ data: { contract_id: '0.0.5', evm_address: '0xabc' } });
    expect((await getContractInfo('0.0.5', 'https://mirror.example'))?.deleted).toBe(false);
    axiosGet.mockResolvedValueOnce({
      data: { contract_id: '0.0.5', evm_address: '0xabc', deleted: true },
    });
    expect((await getContractInfo('0.0.5', 'https://mirror.example'))?.deleted).toBe(true);
  });

  test('resolves null on 404 (not found)', async () => {
    axiosGet.mockRejectedValueOnce(axiosError(404));
    expect(await getContractInfo('0.0.5', 'https://mirror.example')).toBeNull();
  });

  test('rethrows other failures so "not found" is distinguishable from "could not check"', async () => {
    const e500 = axiosError(500);
    axiosGet.mockRejectedValueOnce(e500);
    await expect(getContractInfo('0.0.5', 'https://mirror.example')).rejects.toBe(e500);

    const offline = axiosError();
    axiosGet.mockRejectedValueOnce(offline);
    await expect(getContractInfo('0.0.5', 'https://mirror.example')).rejects.toBe(offline);

    const plain = new Error('boom');
    axiosGet.mockRejectedValueOnce(plain);
    await expect(getContractInfo('0.0.5', 'https://mirror.example')).rejects.toBe(plain);
  });
});

describe('mirrorNodeDataService.callContract', () => {
  beforeEach(() => {
    axiosPost.mockReset();
  });

  test('posts the request to /contracts/call and returns the result', async () => {
    axiosPost.mockResolvedValueOnce({ data: { result: '0x01' } });
    const controller = new AbortController();
    const req = { to: '0xabc', data: '0x1234' };
    const res = await callContract(req, 'https://mirror.example', controller);
    expect(res).toEqual({ success: true, result: '0x01' });
    expect(axiosPost).toHaveBeenCalledWith(
      expect.stringMatching(/\/contracts\/call$/),
      req,
      { signal: controller.signal },
    );
  });

  test('works without an abort controller', async () => {
    axiosPost.mockResolvedValueOnce({ data: { result: '0x' } });
    expect(await callContract({ to: '0xabc' }, 'https://mirror.example')).toEqual({
      success: true,
      result: '0x',
    });
  });

  test('surfaces the mirror node revert message', async () => {
    axiosPost.mockRejectedValueOnce(
      axiosError(400, { _status: { messages: [{ message: 'CONTRACT_REVERT_EXECUTED' }] } }),
    );
    expect(await callContract({ to: '0xabc' }, 'https://mirror.example')).toEqual({
      success: false,
      errorMessage: 'CONTRACT_REVERT_EXECUTED',
    });
  });

  test('falls back to a generic message when none is provided', async () => {
    const generic = { success: false, errorMessage: 'Contract call simulation failed' };
    axiosPost.mockRejectedValueOnce(axiosError(500, {}));
    expect(await callContract({ to: '0xabc' }, 'https://mirror.example')).toEqual(generic);
    axiosPost.mockRejectedValueOnce(axiosError());
    expect(await callContract({ to: '0xabc' }, 'https://mirror.example')).toEqual(generic);
    axiosPost.mockRejectedValueOnce(new Error('network'));
    expect(await callContract({ to: '0xabc' }, 'https://mirror.example')).toEqual(generic);
  });
});
