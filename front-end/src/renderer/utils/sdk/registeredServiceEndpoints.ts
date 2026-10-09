import {
  RegisteredServiceEndpoint,
  BlockNodeServiceEndpoint,
  GeneralServiceEndpoint,
  MirrorNodeServiceEndpoint,
  RpcRelayServiceEndpoint,
} from '@hiero-ledger/sdk';
import { areByteArraysEqual } from '@shared/utils/byteUtils.ts';

export function compareServiceEndpoints(
  ep1: RegisteredServiceEndpoint[],
  ep2: RegisteredServiceEndpoint[],
): boolean {
  if (ep1.length !== ep2.length) return false;
  for (let i = 0; i < ep1.length; i += 1) {
    if (!compareServiceEndpoint(ep1[i], ep2[i])) return false;
  }
  return true;
}

export function compareServiceEndpoint(
  p1: RegisteredServiceEndpoint,
  p2: RegisteredServiceEndpoint,
): boolean {


  if (p1 instanceof BlockNodeServiceEndpoint && p2 instanceof BlockNodeServiceEndpoint) {
    return compareBlockNodeServiceEndpoint(p1, p2);
  } else if (p1 instanceof GeneralServiceEndpoint && p2 instanceof GeneralServiceEndpoint) {
    return compareGeneraleServiceEndpoint(p1, p2);
  } else if (p1 instanceof MirrorNodeServiceEndpoint && p2 instanceof MirrorNodeServiceEndpoint) {
    return compareMirrorNodeServiceEndpoint(p1, p2);
  } else if (p1 instanceof RpcRelayServiceEndpoint && p2 instanceof RpcRelayServiceEndpoint) {
    return compareRpcRelayServiceEndpoint(p1, p2);
  } else {
    return false;
  }
}

function compareBlockNodeServiceEndpoint(
  p1: BlockNodeServiceEndpoint,
  p2: BlockNodeServiceEndpoint,
): boolean {
  if (!compareGenericServiceEndpoint(p1, p2)) return false;
  if (p1.endpointApis.length !== p2.endpointApis.length) return false;
  for (let i = 0; i < p1.endpointApis.length; i += 1) {
    if (p1.endpointApis[i] !== p2.endpointApis[i]) return false;
  }
  return true;
}

function compareGeneraleServiceEndpoint(
  p1: GeneralServiceEndpoint,
  p2: GeneralServiceEndpoint,
): boolean {
  if (!compareGenericServiceEndpoint(p1, p2)) return false;
  return p1.description === p2.description;
}

function compareMirrorNodeServiceEndpoint(
  p1: MirrorNodeServiceEndpoint,
  p2: MirrorNodeServiceEndpoint,
): boolean {
  return compareGenericServiceEndpoint(p1, p2);
}

function compareRpcRelayServiceEndpoint(
  p1: RpcRelayServiceEndpoint,
  p2: RpcRelayServiceEndpoint,
): boolean {
  return compareGenericServiceEndpoint(p1, p2);
}

function compareGenericServiceEndpoint(
  p1: RegisteredServiceEndpoint,
  p2: RegisteredServiceEndpoint,
): boolean {

  if (p1.type !== p2.type) return false;

  if (p1.ipAddress !== null && p2.ipAddress !== null) {
    if (!areByteArraysEqual(p1.ipAddress, p2.ipAddress)) return false;
  } else {
    if (p1.ipAddress !== p2.ipAddress) return false;
  }

  if (p1.domainName !== null && p2.domainName !== null) {
    if (p1.domainName !== p2.domainName) return false;
  } else {
    if (p1.domainName !== p2.domainName) return false;
  }

  return p1.port === p2.port;
}
