import type { Key, Links, TimestampRange } from './HederaSchema';

export interface IRegisteredNodesResponse {
  registered_nodes: IRegisteredNode[] | undefined;
  links: Links;
}

export interface IRegisteredNode {
  admin_key: Key | null;
  created_timestamp: string | null;
  description: string | null;
  registered_node_id: number;
  service_endpoints: IRegisteredServiceEndPoint[];
  timestamp: TimestampRange;
}

export interface IRegisteredServiceEndPoint {
  block_node: IRegisteredBlockNodeEndpoint | null;
  domain_name: string | null; // The DNS domain name of the service
  general_service: IRegisteredGeneralServiceEndpoint | null;
  ip_address: string | null; // The IP address of the service
  mirror_node: unknown; // SHOULD BE: RegisteredMirrorNodeEndpoint | null
  port: number;
  requires_tls: boolean; // Whether the registered service endpoint requires TLS or not
  rpc_relay: unknown; // SHOULD BE: RegisteredRpcRelayEndpoint | null
  type: RegisteredNodeType; // Registered node type
}

export interface IRegisteredBlockNodeEndpoint {
  endpoint_apis: RegisteredBlockNodeApi[];
}

export enum RegisteredBlockNodeApi {
  OTHER = 'OTHER',
  STATUS = 'STATUS',
  PUBLISH = 'PUBLISH',
  SUBSCRIBE_STREAM = 'SUBSCRIBE_STREAM',
  STATE_PROOF = 'STATE_PROOF',
  UNRECOGNIZED = 'UNRECOGNIZED',
}

export interface IRegisteredGeneralServiceEndpoint {
  description: string;
}

//
// These are currently empty in MN OpenAPI definition
//
// export interface IRegisteredMirrorNodeEndpoint {
// }
//
// export interface IRegisteredRpcRelayEndpoint {
// }

export enum RegisteredNodeType {
  BLOCK_NODE = 'BLOCK_NODE',
  GENERAL_SERVICE = 'GENERAL_SERVICE',
  MIRROR_NODE = 'MIRROR_NODE',
  RPC_RELAY = 'RPC_RELAY',
}
