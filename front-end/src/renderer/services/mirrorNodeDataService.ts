import {
  type AccountInfo,
  type IAccountInfoParsed,
  type CryptoAllowance,
  type NetworkExchangeRateSetResponse,
  type TransactionByIdResponse,
  type AccountsResponse,
  type NetworkNode,
  type NetworkNodesResponse,
  type INodeInfoParsed,
  type Key as NetworkResponseKey,
  type RegisteredNode,
  type RegisteredServiceEndPoint,
  type RegisteredBlockNodeEndpoint,
  RegisteredNodeType,
} from '@shared/interfaces';

import {
  RegisteredServiceEndpoint as SDKRegisteredServiceEndpoint,
  BlockNodeServiceEndpoint as SDKBlockNodeServiceEndpoint,
  MirrorNodeServiceEndpoint as SDKMirrorNodeServiceEndpoint,
  RpcRelayServiceEndpoint as SDKRpcRelayServiceEndpoint,
  GeneralServiceEndpoint as SDKGeneralServiceEndpoint,
} from '@hiero-ledger/sdk';

import axios from 'axios';
import { createLogger } from '@renderer/utils/logger';

const logger = createLogger('renderer.mirrorNodeDataService');

import {
  AccountId,
  EvmAddress,
  FileId,
  Hbar,
  HbarUnit,
  PublicKey,
  Timestamp,
} from '@hiero-ledger/sdk';
import { BigNumber } from 'bignumber.js';

import {
  decodeProtobuffKey,
  getServiceEndpoints,
  isAccountId,
  isFileId,
  parseHbar,
  getServiceEndpoint,
} from '@renderer/utils';
import type { IRegisteredNodeInfoParsed } from '@shared/interfaces/IRegisteredNodeInfoParsed';

/* Mirror node data service */
const withAPIPrefix = (url: string) => `${url}/api/v1`;

/* Get users account id by a public key */
export const getAccountsByPublicKey = async (
  mirrorNodeURL: string,
  publicKey: string,
): Promise<AccountInfo[]> => {
  let accounts: AccountInfo[] = [];

  try {
    let nextUrl: string | null =
      `${withAPIPrefix(mirrorNodeURL)}/accounts/?account.publickey=${publicKey}&limit=100&order=asc`;

    while (nextUrl) {
      const res = await axios.get<AccountsResponse>(nextUrl);
      const data: AccountsResponse = res.data;
      accounts = accounts.concat(data.accounts || []);

      if (data.links?.next) {
        nextUrl = `${withAPIPrefix(mirrorNodeURL)}${data.links.next.slice(data.links.next.indexOf('/accounts'))}`;
      } else {
        nextUrl = null;
      }
    }

    return accounts;
  } catch (error) {
    logger.error('Failed to get accounts by public key', { error });
    return accounts;
  }
};

/* Gets the account information by account id */
export const getAccountInfo = async (
  accountId: string,
  mirrorNodeLink: string,
  controller?: AbortController,
) => {
  const { data } = await axios.get(`${withAPIPrefix(mirrorNodeLink)}/accounts/${accountId}`, {
    signal: controller?.signal,
  });

  const rawAccountInfo: AccountInfo = data;

  if (!data.account) {
    return null;
  }

  const accountInfo: IAccountInfoParsed = {
    accountId: AccountId.fromString(rawAccountInfo.account || ''),
    alias: rawAccountInfo.alias as string,
    balance: Hbar.from(rawAccountInfo.balance?.balance || 0, HbarUnit.Tinybar),
    declineReward: Boolean(rawAccountInfo.decline_reward),
    deleted: Boolean(rawAccountInfo.deleted),
    ethereumNonce: Number(rawAccountInfo.ethereum_nonce),
    evmAddress: EvmAddress.fromString(rawAccountInfo.evm_address || ''),
    createdTimestamp: rawAccountInfo.created_timestamp
      ? new Timestamp(
          Number(rawAccountInfo.created_timestamp.split('.')[0]),
          Number(rawAccountInfo.created_timestamp.split('.')[1]),
        )
      : null,
    expiryTimestamp: rawAccountInfo.expiry_timestamp
      ? new Timestamp(
          Number(rawAccountInfo.expiry_timestamp.split('.')[0]),
          Number(rawAccountInfo.expiry_timestamp.split('.')[1]),
        )
      : null,
    key: parseNetworkResponseKey(rawAccountInfo.key),
    maxAutomaticTokenAssociations: rawAccountInfo.max_automatic_token_associations,
    memo: rawAccountInfo.memo,
    pendingRewards: Hbar.from(rawAccountInfo.pending_reward || 0, HbarUnit.Tinybar),
    receiverSignatureRequired: Boolean(rawAccountInfo.receiver_sig_required),
    stakedAccountId: rawAccountInfo.staked_account_id
      ? AccountId.fromString(rawAccountInfo.staked_account_id)
      : null,
    stakedNodeId:
      rawAccountInfo.staked_node_id !== null ? Number(rawAccountInfo.staked_node_id) : null,
    autoRenewPeriod: rawAccountInfo.auto_renew_period,
  };

  return accountInfo;
};

/* Gets the account allowances by account id */
export const getAccountAllowances = async (
  accountId: string,
  mirrorNodeLink: string,
  controller?: AbortController,
) => {
  const { data } = await axios.get(
    `${withAPIPrefix(mirrorNodeLink)}/accounts/${accountId}/allowances/crypto`,
    {
      signal: controller?.signal,
    },
  );

  const allowances: CryptoAllowance[] = data.allowances;

  return allowances;
};

/* Gets the exchange rate set */
export const getExchangeRateSet = async (mirrorNodeLink: string, controller?: AbortController) => {
  try {
    const { data } = await axios.get(`${withAPIPrefix(mirrorNodeLink)}/network/exchangerate`, {
      signal: controller?.signal,
    });

    const exchangeRateSet: NetworkExchangeRateSetResponse = data;

    return exchangeRateSet;
  } catch {
    logger.warn('Failed to fetch exchange rate');
    return null;
  }
};

/* Gets the dollar value for given hbars */
export const getDollarAmount = (hbarPrice: number, hbarAmount: BigNumber) => {
  const fractionDigits = 5;

  let result: string;

  if (hbarPrice !== null) {
    const resolution = Math.pow(10, -fractionDigits);
    let usdAmount = hbarAmount.times(hbarPrice);
    if (usdAmount.isGreaterThan(0) && usdAmount.isLessThan(+resolution)) {
      usdAmount = new BigNumber(resolution);
    } else if (usdAmount.isGreaterThan(-resolution) && usdAmount.isLessThan(0)) {
      usdAmount = new BigNumber(-resolution);
    }
    result = `$${usdAmount.decimalPlaces(fractionDigits)}`;
  } else {
    result = '';
  }
  return result;
};

/* Gets the transaction information by transaction id */
export const getTransactionInfo = async (
  transactionId: string,
  mirrorNodeLink: string,
  controller?: AbortController,
) => {
  const { data } = await axios.get<TransactionByIdResponse>(
    `${withAPIPrefix(mirrorNodeLink)}/transactions/${transactionId}`,
    {
      signal: controller?.signal,
    },
  );

  return data;
};

/* Gets the network nodes information */
export const getNetworkNodes = async (mirrorNodeURL: string) => {
  let networkNodes: NetworkNode[] = [];

  try {
    let nextUrl: string | null = `${withAPIPrefix(mirrorNodeURL)}/network/nodes?limit=100`;

    while (nextUrl) {
      const res = await axios.get(nextUrl);
      const data: NetworkNodesResponse = res.data;
      networkNodes = networkNodes.concat(data.nodes || []);

      if (data.links?.next) {
        nextUrl = `${withAPIPrefix(mirrorNodeURL)}${data.links.next.slice(data.links.next.indexOf('/network'))}`;
      } else {
        nextUrl = null;
      }
    }

    return networkNodes;
  } catch (error) {
    logger.error('Failed to get network nodes', { error });
    return networkNodes;
  }
};

/* Gets the network node information */
export const getNodeInfo = async (
  nodeId: number,
  mirrorNodeURL: string,
): Promise<INodeInfoParsed | null> => {
  try {
    const res = await axios.get(
      `${withAPIPrefix(mirrorNodeURL)}/network/nodes?node.id=eq:${nodeId}`,
    );
    const data: NetworkNodesResponse = res.data;

    if (data.nodes && data.nodes.length > 0) {
      const node = data.nodes[0];

      const nodeInfo: INodeInfoParsed = {
        admin_key: parseNetworkResponseKey(node.admin_key),
        description: node.description?.trim() || null,
        file_id: node.file_id && isFileId(node.file_id) ? FileId.fromString(node.file_id) : null,
        memo: node.memo?.trim() || null,
        node_id: node.node_id || null,
        node_account_id:
          node.node_account_id && isAccountId(node.node_account_id)
            ? AccountId.fromString(node.node_account_id)
            : null,
        node_cert_hash: node.node_cert_hash?.trim() || null,
        public_key: node.public_key || null,
        service_endpoints: getServiceEndpoints(
          node.service_endpoints?.map(se => ({
            ipAddressV4: se.ip_address_v4,
            port: se.port.toString(),
            domainName: '',
          })) || [],
        ),
        timestamp: node.timestamp || null,
        max_stake: parseHbar(node.max_stake, HbarUnit.Tinybar),
        min_stake: parseHbar(node.min_stake, HbarUnit.Tinybar),
        stake: parseHbar(node.stake, HbarUnit.Tinybar),
        stake_not_rewarded: parseHbar(node.stake_not_rewarded, HbarUnit.Tinybar),
        stake_rewarded: parseHbar(node.stake_rewarded, HbarUnit.Tinybar),
        staking_period: node.staking_period || null,
        reward_rate_start: parseHbar(node.reward_rate_start, HbarUnit.Tinybar),
        decline_reward: node.decline_reward ?? false,
        grpc_web_proxy_endpoint: node.grpc_proxy_endpoint
          ? getServiceEndpoint({
              ipAddressV4: '',
              port: node.grpc_proxy_endpoint.port.toString(),
              domainName: node.grpc_proxy_endpoint.domain_name || '',
            })
          : null,
        associated_registered_nodes: node.associated_registered_nodes ?? [],
      };
      return nodeInfo;
    }
    return null;
  } catch (error) {
    logger.error('Failed to get node info', { error });
    return null;
  }
};

export const parseNetworkResponseKey = (key: NetworkResponseKey | null | undefined) => {
  try {
    switch (key?._type) {
      case 'ProtobufEncoded':
        return decodeProtobuffKey(key.key || '') || null;
      case 'ED25519':
        return PublicKey.fromStringED25519(key.key || '');
      case 'ECDSA_SECP256K1':
        return PublicKey.fromStringECDSA(key.key || '');
      default:
        return null;
    }
  } catch (error) {
    logger.error('Failed to parse network response key', { error });
    return null;
  }
};

export const parseRegisteredNode = (registeredNode: RegisteredNode): IRegisteredNodeInfoParsed|null => {
  let result: IRegisteredNodeInfoParsed|null;

  const endpoints = parseRegisteredServiceEndpoints(registeredNode.service_endpoints);
  if (endpoints !== null) {
    result = {
      admin_key: parseNetworkResponseKey(registeredNode.admin_key),
      created_timestamp: registeredNode.created_timestamp,
      description: registeredNode.description,
      registered_node_id: registeredNode.registered_node_id,
      service_endpoints: endpoints,
      timestamp: registeredNode.timestamp,
    }
  } else {
    result = null;
  }

  return result;
};

export function parseRegisteredServiceEndpoints(
  endpoints: RegisteredServiceEndPoint[],
): SDKRegisteredServiceEndpoint[] | null {
  const result: SDKRegisteredServiceEndpoint[] = [];
  let errorCount = 0;
  for (const endpoint of endpoints) {
    const r = parseRegisteredServiceEndpoint(endpoint);
    if (r !== null) {
      result.push(r);
    } else {
      errorCount += 1;
    }
  }
  return errorCount == 0 ? result : null;
};

export function parseRegisteredServiceEndpoint(
  endpoint: RegisteredServiceEndPoint,
): SDKRegisteredServiceEndpoint | null{
  let result: SDKRegisteredServiceEndpoint | null;

  switch (endpoint.type) {
    case RegisteredNodeType.BLOCK_NODE: {
      const r = new SDKBlockNodeServiceEndpoint();
      const apis = endpoint.block_node !== null ? parseBlockNodeApis(endpoint.block_node) : null;
      if (apis !== null) {
        r.setEndpointApis(parseBlockNodeApis(endpoint.block_node));
        result = r;
      } else {
        result = null
      }
      break;
    }
    case RegisteredNodeType.MIRROR_NODE: {
      result = new SDKMirrorNodeServiceEndpoint();
      break;
    }
    case RegisteredNodeType.RPC_RELAY: {
      result = new SDKRpcRelayServiceEndpoint();
      break;
    }
    case RegisteredNodeType.GENERAL_SERVICE: {
      const r = new SDKGeneralServiceEndpoint();
      if (endpoint.general_service?.description) {
        r.setDescription(endpoint.general_service.description);
      }
      result = r;
      break;
    }
    default: {
      result = null;
    }
  }

  if (result !== null) {
    const ipAddress = endpoint.ip_address !== null ? parseIpAddressV4(endpoint.ip_address) : null;
    if (ipAddress !== null) {
      result.setIpAddress(ipAddress);
    }
    if (endpoint.domain_name !== null) {
      result.setDomainName(endpoint.domain_name);
    }
    result.setPort(endpoint.port);
    result.setRequiresTls(endpoint.requires_tls);
  }

  return result;
}

export function parseIpAddressV4(address: string): Uint8Array | null {
  const bytes = address.split('.').map(v => parseInt(v));
  return bytes.length == 4 ? Uint8Array.from(bytes) : null;
}

export function parseBlockNodeApis(blockNode: RegisteredBlockNodeEndpoint | null): number[] {
  const result: number[] = [];

  if (blockNode !== null) {

  }

  return result;
}
