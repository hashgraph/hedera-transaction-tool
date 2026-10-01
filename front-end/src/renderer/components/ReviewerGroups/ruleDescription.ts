import type { EntityRole } from '@shared/interfaces';

import { TransactionType, TransactionTypeLabels } from '@shared/interfaces';
import { CommonNetworkNames } from '@shared/enums';

export const ROLE_LABELS: Record<EntityRole, string> = {
  fee_payer: 'fee payer',
  sender: 'sender',
  receiver: 'receiver',
  account: 'account',
  file: 'file',
  token: 'token',
  topic: 'topic',
  node: 'node',
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// Per-column formatters for the rule table (ReviewerGroupDetails.vue), as opposed to
// describeRule's single combined sentence used for the rule-creation preview.
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

export function describeRule(rule: {
  hederaEntityId: string;
  entityRole?: EntityRole | null;
  transactionType?: string | null;
}): string {
  const entityId = rule.hederaEntityId || '<entity id>';
  const typeLabel = rule.transactionType
    ? (TransactionTypeLabels[rule.transactionType as TransactionType] ?? rule.transactionType)
    : null;
  const typePart = typeLabel ? `any ${typeLabel}` : 'any';
  const rolePart = rule.entityRole
    ? `where ${entityId} is the ${ROLE_LABELS[rule.entityRole]}`
    : `involving ${entityId}`;

  return `This group will be assigned to ${typePart} transaction ${rolePart}.`;
}
