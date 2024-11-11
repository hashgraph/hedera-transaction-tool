import {
  NetworkNode,
  NodeInfoParsed,
  KeyType,
  decodeProtobuffKey,
  isAccountId,
  ServiceEndPoint,
  parseHbar,
  isFileId,
  TimestampRange,
} from '@app/common';
import { AccountId, FileId, Hbar, HbarUnit, Key, PublicKey, ServiceEndpoint } from '@hashgraph/sdk';

export const parseNodeInfo = (nodeInfo: NetworkNode) => {
  const nodeInfoParsed: NodeInfoParsed = {
    admin_key: parseNodeProperty(nodeInfo, 'admin_key'),
    domain_name: parseNodeProperty(nodeInfo, 'domain_name'),
    description: parseNodeProperty(nodeInfo, 'description'),
    file_id: parseNodeProperty(nodeInfo, 'file_id'),
    memo: parseNodeProperty(nodeInfo, 'memo'),
    node_id: parseNodeProperty(nodeInfo, 'node_id'),
    node_account_id: parseNodeProperty(nodeInfo, 'node_account_id'),
    node_cert_hash: parseNodeProperty(nodeInfo, 'node_cert_hash'),
    public_key: parseNodeProperty(nodeInfo, 'public_key'),
    service_endpoints: parseNodeProperty(nodeInfo, 'service_endpoints'),
    timestamp: parseNodeProperty(nodeInfo, 'timestamp'),
    max_stake: parseNodeProperty(nodeInfo, 'max_stake'),
    min_stake: parseNodeProperty(nodeInfo, 'min_stake'),
    stake: parseNodeProperty(nodeInfo, 'stake'),
    stake_not_rewarded: parseNodeProperty(nodeInfo, 'stake_not_rewarded'),
    stake_rewarded: parseNodeProperty(nodeInfo, 'stake_rewarded'),
    staking_period: parseNodeProperty(nodeInfo, 'staking_period'),
    reward_rate_start: parseNodeProperty(nodeInfo, 'reward_rate_start'),
  };

  return nodeInfoParsed;
};

export function parseNodeProperty(
  nodeInfo: NetworkNode,
  property: 'node_account_id',
): AccountId | null;
export function parseNodeProperty(nodeInfo: NetworkNode, property: 'file_id'): FileId | null;
export function parseNodeProperty(
  nodeInfo: NetworkNode,
  property:
    | 'max_stake'
    | 'min_stake'
    | 'stake'
    | 'stake_not_rewarded'
    | 'stake_rewarded'
    | 'reward_rate_start',
): Hbar | null;
export function parseNodeProperty(
  nodeInfo: NetworkNode,
  property: 'timestamp' | 'staking_period',
): TimestampRange | null;
export function parseNodeProperty(nodeInfo: NetworkNode, property: 'admin_key'): Key | null;
export function parseNodeProperty(
  nodeInfo: NetworkNode,
  property: 'service_endpoints',
): ServiceEndpoint[] | null;
export function parseNodeProperty(nodeInfo: NetworkNode, property: 'node_id'): number | null;
export function parseNodeProperty(
  nodeInfo: NetworkNode,
  property: 'domain_name' | 'description' | 'memo' | 'public_key' | 'node_cert_hash',
): string | null;
export function parseNodeProperty(nodeInfo: NetworkNode, property: keyof NetworkNode) {
  switch (property) {
    case 'file_id':
      return isFileId(nodeInfo.file_id) ? FileId.fromString(nodeInfo.file_id) : null;
    case 'node_id':
      return nodeInfo.node_id || null;
    case 'node_account_id':
      return isAccountId(nodeInfo.node_account_id)
        ? AccountId.fromString(nodeInfo.node_account_id)
        : null;
    case 'node_cert_hash':
      return nodeInfo.node_cert_hash?.trim() || null;
    case 'public_key':
      return nodeInfo.public_key?.trim() || null;
    case 'service_endpoints':
      return getServiceEndpoints(nodeInfo.service_endpoints);
    case 'timestamp':
      return nodeInfo.timestamp || null;
    case 'admin_key':
      if (!nodeInfo.admin_key) return null;
      switch (nodeInfo.admin_key._type) {
        case KeyType.ProtobufEncoded:
          return decodeProtobuffKey(nodeInfo.admin_key?.key);
        case KeyType.ED25519:
          return PublicKey.fromStringED25519(nodeInfo.admin_key?.key);
        case KeyType.ECDSA_SECP256K1:
          return PublicKey.fromStringECDSA(nodeInfo.admin_key?.key);
        default:
          return null;
      }
    case 'max_stake':
      return parseHbar(nodeInfo.max_stake, HbarUnit.Tinybar);
    case 'min_stake':
      return parseHbar(nodeInfo.min_stake, HbarUnit.Tinybar);
    case 'stake':
      return parseHbar(nodeInfo.stake, HbarUnit.Tinybar);
    case 'stake_not_rewarded':
      return parseHbar(nodeInfo.stake_not_rewarded, HbarUnit.Tinybar);
    case 'stake_rewarded':
      return parseHbar(nodeInfo.stake_rewarded, HbarUnit.Tinybar);
    case 'reward_rate_start':
      return parseHbar(nodeInfo.reward_rate_start, HbarUnit.Tinybar);
    case 'staking_period':
      return nodeInfo.staking_period || null;
    case 'memo':
      return nodeInfo.memo?.trim() || null;
    case 'domain_name':
      return nodeInfo.domain_name?.trim() || null;
    case 'description':
      return nodeInfo.description?.trim() || null;
    default:
      throw new Error(`Unknown account info  property: ${property}`);
  }
}

export const getServiceEndpoints = (data: ServiceEndPoint[] | undefined) => {
  const endpoints = new Array<ServiceEndpoint>();

  for (const se of data || []) {
    const ipAddressV4 = se.ip_address_v4?.trim()?.split('.') || [];
    const domainName = se.domain_name?.trim();

    if (ipAddressV4 || domainName) {
      const serviceEndpoint = new ServiceEndpoint();

      if (ipAddressV4.length === 4) {
        serviceEndpoint.setIpAddressV4(Uint8Array.from(ipAddressV4.map(Number)));
      } else if (domainName) {
        serviceEndpoint.setDomainName(domainName);
      }

      if (se.port) {
        serviceEndpoint.setPort(se.port);
      }

      endpoints.push(serviceEndpoint);
    }
  }

  return endpoints;
};
