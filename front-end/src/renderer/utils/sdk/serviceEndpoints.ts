import { ServiceEndpoint } from '@hiero-ledger/sdk';
import { areByteArraysEqual } from '@shared/utils/byteUtils.ts';

export function compareNodeServiceEndpoint(p1: ServiceEndpoint, p2: ServiceEndpoint): boolean {
  if (p1.getIpAddressV4 !== null && p2.getIpAddressV4 !== null) {
    if (!areByteArraysEqual(p1.getIpAddressV4, p2.getIpAddressV4)) return false;
  } else {
    if (p1.getIpAddressV4 !== p2.getIpAddressV4) return false;
  }

  if (p1.getDomainName !== null && p2.getDomainName !== null) {
    if (p1.getDomainName !== p2.getDomainName) return false;
  } else {
    if (p1.getDomainName !== p2.getDomainName) return false;
  }

  if (p1.getPort !== null && p2.getPort !== null) {
    if (p1.getPort !== p2.getPort) return false;
  } else {
    if (p1.getPort !== p2.getPort) return false;
  }

  return true;
}
