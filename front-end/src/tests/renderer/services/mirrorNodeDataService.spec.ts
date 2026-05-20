// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from 'vitest';

const { axiosGet } = vi.hoisted(() => ({ axiosGet: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    get: axiosGet,
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

import { getNodeInfo } from '@renderer/services/mirrorNodeDataService';

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

describe('mirrorNodeDataService.getNodeInfo — associated_registered_node', () => {
  beforeEach(() => {
    axiosGet.mockReset();
  });

  test('defaults to [] when the mirror response omits the field', async () => {
    mockNodesResponse(nodePayload()); // no associated_registered_node key
    const info = await getNodeInfo(3, 'https://mirror.example');
    expect(info?.associated_registered_node).toEqual([]);
  });

  test('passes a numeric array through unchanged', async () => {
    mockNodesResponse(nodePayload({ associated_registered_node: [1, 7, 12] }));
    const info = await getNodeInfo(3, 'https://mirror.example');
    expect(info?.associated_registered_node).toEqual([1, 7, 12]);
  });

  test('treats explicit null as []', async () => {
    mockNodesResponse(nodePayload({ associated_registered_node: null }));
    const info = await getNodeInfo(3, 'https://mirror.example');
    expect(info?.associated_registered_node).toEqual([]);
  });

  test('treats explicit empty array as []', async () => {
    mockNodesResponse(nodePayload({ associated_registered_node: [] }));
    const info = await getNodeInfo(3, 'https://mirror.example');
    expect(info?.associated_registered_node).toEqual([]);
  });
});
