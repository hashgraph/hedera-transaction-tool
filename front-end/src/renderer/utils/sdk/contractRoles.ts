import type { AbiFunctionItem } from './abi';

// Deliberately has no notion of a "holder": a role can have any number of holders and an account
// can hold any number of roles, so the registry can't represent that relationship with a single
// field on the role - it only tracks the role's own identity (name + resolved on-chain value).
export interface ContractRole {
  id: string;
  name: string;
  /* Resolved bytes32 value, only ever set by actually calling the role's own getter on-chain
   * (see contractCall.ts's resolveBytes32Getter). Never guessed locally. */
  value?: string;
  verified: boolean;
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
