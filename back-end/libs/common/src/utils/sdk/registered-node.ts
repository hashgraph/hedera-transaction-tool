import {
  decodeProtobufKey,
  KeyType,
  RegisteredBlockNodeApi,
  RegisteredNode,
  RegisteredNodeInfoParsed,
  RegisteredNodeType,
  RegisteredServiceEndpoint,
  TimestampRange,
} from '@app/common';
import {
  BlockNodeServiceEndpoint as SDKBlockNodeServiceEndpoint,
  GeneralServiceEndpoint as SDKGeneralServiceEndpoint,
  Key,
  MirrorNodeServiceEndpoint as SDKMirrorNodeServiceEndpoint,
  PublicKey,
  RegisteredServiceEndpoint as SDKRegisteredServiceEndpoint,
  RpcRelayServiceEndpoint as SDKRpcRelayServiceEndpoint,
  BlockNodeApi as SDKBlockNodeApi,
} from '@hiero-ledger/sdk';

export const parseRegisteredNodeInfo = (nodeInfo: RegisteredNode) => {
  const registerdNodeInfoParsed: RegisteredNodeInfoParsed = {
    admin_key: parseRegisteredNodeProperty(nodeInfo, 'admin_key'),
    created_timestamp: parseRegisteredNodeProperty(nodeInfo, 'created_timestamp'),
    description: parseRegisteredNodeProperty(nodeInfo, 'description'),
    registered_node_id: parseRegisteredNodeProperty(nodeInfo, 'registered_node_id'),
    service_endpoints: parseRegisteredNodeProperty(nodeInfo, 'service_endpoints'),
    timestamp: parseRegisteredNodeProperty(nodeInfo, 'timestamp'),
  };

  return registerdNodeInfoParsed;
};

export function parseRegisteredNodeProperty(
  nodeInfo: RegisteredNode,
  property: 'admin_key',
): Key | null;
export function parseRegisteredNodeProperty(
  nodeInfo: RegisteredNode,
  property: 'description' | 'created_timestamp',
): string | null;
export function parseRegisteredNodeProperty(
  nodeInfo: RegisteredNode,
  property: 'registered_node_id',
): number | null;
export function parseRegisteredNodeProperty(
  nodeInfo: RegisteredNode,
  property: 'service_endpoints',
): SDKRegisteredServiceEndpoint[] | null;
export function parseRegisteredNodeProperty(
  nodeInfo: RegisteredNode,
  property: 'timestamp',
): TimestampRange | null;
export function parseRegisteredNodeProperty(
  nodeInfo: RegisteredNode,
  property: keyof RegisteredNode,
) {
  switch (property) {
    case 'admin_key':
      if (!nodeInfo.admin_key) return null;
      switch (nodeInfo.admin_key._type) {
        case KeyType.ProtobufEncoded:
          return decodeProtobufKey(nodeInfo.admin_key?.key);
        case KeyType.ED25519:
          return PublicKey.fromStringED25519(nodeInfo.admin_key?.key);
        case KeyType.ECDSA_SECP256K1:
          return PublicKey.fromStringECDSA(nodeInfo.admin_key?.key);
        default:
          return null;
      }
    case 'created_timestamp':
      return nodeInfo.created_timestamp?.trim() || null;
    case 'description':
      return nodeInfo.description?.trim() || null;
    case 'registered_node_id':
      return nodeInfo.registered_node_id || null;
    case 'service_endpoints':
      return getRegisteredServiceEndpoints(nodeInfo.service_endpoints);
    case 'timestamp':
      return nodeInfo.timestamp || null;
    default:
      throw new Error(`Unknown account info  property: ${property}`);
  }
}

export const getRegisteredServiceEndpoints = (data: RegisteredServiceEndpoint[] | undefined) => {
  const endpoints = new Array<SDKRegisteredServiceEndpoint>();

  for (const se of data || []) {
    const serviceEndpoint = getRegisteredServiceEndpoint(se);

    if (serviceEndpoint) {
      endpoints.push(serviceEndpoint);
    }
  }

  return endpoints;
};

export const getRegisteredServiceEndpoint = (endPoint: RegisteredServiceEndpoint | undefined) => {
  if (!endPoint) {
    return null;
  }

  let result: SDKRegisteredServiceEndpoint;
  switch (endPoint.type) {
    case RegisteredNodeType.BLOCK_NODE:
      result = getRegisteredBlockNodeServiceEndpoint(endPoint);
      break;
    case RegisteredNodeType.GENERAL_SERVICE:
      result = getRegisteredGeneralServiceEndpoint(endPoint);
      break;
    case RegisteredNodeType.MIRROR_NODE:
      result = getRegisteredMirrorNodeServiceEndpoint(endPoint);
      break;
    case RegisteredNodeType.RPC_RELAY:
      result = getRegisteredRpcRelayServiceEndpoint(endPoint);
      break;
    default:
      return null;
  }

  const ipAddressV4 = endPoint.ip_address?.trim()?.split('.') || [];
  const domainName = endPoint.domain_name?.trim();
  const port = endPoint.port;
  const requires_tls = endPoint.requires_tls;

  if ((ipAddressV4.length > 0 || domainName) && port) {
    if (ipAddressV4.length === 4) {
      result.setIpAddress(Uint8Array.from(ipAddressV4.map(Number)));
    } else if (domainName) {
      result.setDomainName(domainName);
    }

    if (endPoint.port) {
      result.setPort(endPoint.port);
    }

    result.setRequiresTls(Boolean(requires_tls));

    return result;
  }

  return null;
};

export const getRegisteredBlockNodeServiceEndpoint = (endpoint: RegisteredServiceEndpoint) => {
  const blockNode = endpoint.block_node;
  if (!blockNode) {
    return null;
  }
  const sdkApis: SDKBlockNodeApi[] = [];
  if (blockNode.endpoint_apis.includes(RegisteredBlockNodeApi.OTHER)) {
    sdkApis.push(SDKBlockNodeApi.Other);
  }
  if (blockNode.endpoint_apis.includes(RegisteredBlockNodeApi.STATUS)) {
    sdkApis.push(SDKBlockNodeApi.Status);
  }
  if (blockNode.endpoint_apis.includes(RegisteredBlockNodeApi.PUBLISH)) {
    sdkApis.push(SDKBlockNodeApi.Publish);
  }
  if (blockNode.endpoint_apis.includes(RegisteredBlockNodeApi.SUBSCRIBE_STREAM)) {
    sdkApis.push(SDKBlockNodeApi.SubscribeStream);
  }
  if (blockNode.endpoint_apis.includes(RegisteredBlockNodeApi.STATE_PROOF)) {
    sdkApis.push(SDKBlockNodeApi.StateProof);
  }
  if (blockNode.endpoint_apis.includes(RegisteredBlockNodeApi.UNRECOGNIZED)) {
    sdkApis.push(SDKBlockNodeApi.Other);
  }

  const result = new SDKBlockNodeServiceEndpoint();
  result.setEndpointApis(sdkApis);
  return result;
};

export const getRegisteredGeneralServiceEndpoint = (endpoint: RegisteredServiceEndpoint) => {
  const generalService = endpoint.general_service;
  if (!generalService) {
    return null;
  }
  if (generalService.description !== null && typeof generalService.description !== 'string') {
    return null;
  }
  const result = new SDKGeneralServiceEndpoint();
  result.setDescription(generalService.description);
  return result;
};

export const getRegisteredMirrorNodeServiceEndpoint = (endpoint: RegisteredServiceEndpoint) => {
  const generalService = endpoint.general_service;
  return generalService ? new SDKMirrorNodeServiceEndpoint() : null;
};

export const getRegisteredRpcRelayServiceEndpoint = (endpoint: RegisteredServiceEndpoint) => {
  const rpcRelay = endpoint.rpc_relay;
  return rpcRelay ? new SDKRpcRelayServiceEndpoint() : null;
};
