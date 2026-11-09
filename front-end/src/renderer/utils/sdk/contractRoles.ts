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

export function parseRoles(json: string | null | undefined): ContractRole[] {
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as ContractRole[]) : [];
  } catch {
    return [];
  }
}

export function parseFunctionTags(json: string | null | undefined): Record<string, string> {
  if (!json) {
    return {};
  }
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
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
