import type { EntityRole } from '@shared/interfaces';

import { BackEndTransactionType, ROLE_LABELS, TransactionTypeName } from '@shared/interfaces';
import { CommonNetworkNames } from '@shared/enums';

import { capitalize } from '@renderer/utils';

export function formatRole(entityRole?: EntityRole | null): string {
  return entityRole ? capitalize(ROLE_LABELS[entityRole]) : 'Any';
}

export function formatTransactionType(transactionType?: string | null): string {
  if (!transactionType) return 'Any';
  return TransactionTypeName[transactionType as BackEndTransactionType] ?? transactionType;
}

export function formatNetwork(network: string): string {
  return CommonNetworkNames[network as keyof typeof CommonNetworkNames] ?? network;
}
