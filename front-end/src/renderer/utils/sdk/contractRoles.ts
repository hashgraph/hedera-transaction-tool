import type { AbiFunctionItem } from './abi';

export type RoleHolderType = 'unassigned' | 'account' | 'contract';

export interface ContractRole {
  id: string;
  name: string;
  /* Resolved bytes32 value, only ever set by actually calling the role's own getter on-chain
   * (see contractCall.ts's resolveBytes32Getter). Never guessed locally. */
  value?: string;
  verified: boolean;
  holderType: RoleHolderType;
  holderAccountId?: string;
  holderContractRef?: string;
  note?: string;
}

function safeJsonParse<T>(
  json: string | null | undefined,
  isValid: (parsed: unknown) => boolean,
  fallback: T,
): T {
  if (!json) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(json);
    return isValid(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function parseRoles(json: string | null | undefined): ContractRole[] {
  return safeJsonParse(json, Array.isArray, []);
}

export function parseFunctionTags(json: string | null | undefined): Record<string, string> {
  return safeJsonParse(json, parsed => Boolean(parsed) && typeof parsed === 'object', {});
}

export function getFunctionSignature(fn: AbiFunctionItem): string {
  return `${fn.name}(${fn.inputs.map(i => i.type).join(',')})`;
}

export function createRole(partial: Omit<ContractRole, 'id' | 'verified'>): ContractRole {
  return {
    id: crypto.randomUUID(),
    verified: false,
    ...partial,
  };
}

export function roleHolderSummary(role: ContractRole): string {
  if (role.holderType === 'account') return `Account: ${role.holderAccountId || 'not set'}`;
  if (role.holderType === 'contract') return `Contract: ${role.holderContractRef || 'not set'}`;
  return 'Unassigned';
}
