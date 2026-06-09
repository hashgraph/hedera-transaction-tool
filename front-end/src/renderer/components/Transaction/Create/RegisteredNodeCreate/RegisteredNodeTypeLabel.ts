import type { RegisteredEndpointType } from '@renderer/utils';

export const RegisteredNodeTypeLabel: Record<RegisteredEndpointType, string> = {
  blockNode: 'Block Node',
  mirrorNode: 'Mirror Node',
  rpcRelay: 'RPC Relay',
  generalService: 'General Service',
};
