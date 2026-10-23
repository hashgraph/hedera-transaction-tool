import { ServiceEndpoint } from '@hiero-ledger/sdk';
import { areByteArraysEqual } from '@shared/utils/byteUtils.ts';

export function compareNodeServiceEndpoints(ep1: ServiceEndpoint[], ep2: ServiceEndpoint[]): boolean {
  if (ep1.length !== ep2.length) return false;
  for (let i = 0; i < ep1.length; i += 1) {
    if (!compareNodeServiceEndpoint(ep1[i], ep2[i])) return false;
  }
  return true;
}

export function compareNodeServiceEndpoint(p1: ServiceEndpoint, p2: ServiceEndpoint): boolean {
  if (p1.getIpAddressV4 !== null && p2.getIpAddressV4 !== null) {
    if (!areByteArraysEqual(p1.getIpAddressV4, p2.getIpAddressV4)) return false;
  } else {
    if (p1.getIpAddressV4 !== p2.getIpAddressV4) return false;
  }

  if (p1.getDomainName !== p2.getDomainName) return false;

  return p1.getPort === p2.getPort;
}
