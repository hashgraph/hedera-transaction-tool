import type { EntityRole } from '@shared/interfaces';

import { ROLE_LABELS, TransactionType, TransactionTypeLabels } from '@shared/interfaces';
import { CommonNetworkNames } from '@shared/enums';

import { capitalize } from '@renderer/utils';

export function formatRole(entityRole?: EntityRole | null): string {
  return entityRole ? capitalize(ROLE_LABELS[entityRole]) : 'Any';
}

export function formatTransactionType(transactionType?: string | null): string {
  if (!transactionType) return 'Any';
  return TransactionTypeLabels[transactionType as TransactionType] ?? transactionType;
}

export function formatNetwork(network: string): string {
  return CommonNetworkNames[network as keyof typeof CommonNetworkNames] ?? network;
}
