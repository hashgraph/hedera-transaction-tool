import { parseRegisteredNodeInfo } from '@app/common/utils/sdk/registered-node';
import { BlockNodeApi, BlockNodeServiceEndpoint, PublicKey } from '@hiero-ledger/sdk';

describe('parseRegisteredNodeInfo()', () => {
  it('decode sample registered node', () => {
    const nodeInfo = parseRegisteredNodeInfo(SAMPLE_REGISTERED_NODE as any);
    expect(nodeInfo.admin_key).not.toBeNull();
    expect(nodeInfo.admin_key instanceof PublicKey).toBe(true);
    expect(nodeInfo.created_timestamp).toBe(SAMPLE_REGISTERED_NODE.created_timestamp);
    expect(nodeInfo.description).toBe(SAMPLE_REGISTERED_NODE.description);
    expect(nodeInfo.registered_node_id).toBe(SAMPLE_REGISTERED_NODE.registered_node_id);
    expect(nodeInfo.timestamp).toStrictEqual(SAMPLE_REGISTERED_NODE.timestamp);
    expect(nodeInfo.service_endpoints.length).toStrictEqual(
      SAMPLE_REGISTERED_NODE.service_endpoints.length,
    );

    const ep0 = nodeInfo.service_endpoints[0];
    const sampleEP0 = SAMPLE_REGISTERED_NODE.service_endpoints[0];
    expect(ep0.type).toBe('blockNode');
    expect(ep0.ipAddress).toBe(sampleEP0.ip_address);
    expect(ep0.domainName).toBe(sampleEP0.domain_name);
    expect(ep0.port).toBe(sampleEP0.port);
    expect(ep0.requiresTls).toBe(sampleEP0.requires_tls);

    expect(ep0 instanceof BlockNodeServiceEndpoint).toBe(true);
    const blockNode = ep0 as BlockNodeServiceEndpoint;
    expect(blockNode.endpointApis.length).toBe(1);
    expect(blockNode.endpointApis[0]).toBe(BlockNodeApi.Publish);
  });
});

const SAMPLE_REGISTERED_NODE = {
  admin_key: {
    _type: 'ED25519',
    key: 'c249a323c878f5b5e2daccda6d731e6fdc32f870228d1cd4fae559d947dbc36c',
  },
  created_timestamp: '1777911935.892158021',
  description: 'Local Full History(lfh01)',
  registered_node_id: 7,
  service_endpoints: [
    {
      block_node: {
        endpoint_apis: ['PUBLISH'],
      },
      domain_name: 'lfh01.example.com',
      general_service: null,
      ip_address: null,
      mirror_node: null,
      port: 40840,
      requires_tls: false,
      rpc_relay: null,
      type: 'BLOCK_NODE',
    },
  ],
  timestamp: {
    from: '1777911935.892158021',
    to: null,
  },
};
