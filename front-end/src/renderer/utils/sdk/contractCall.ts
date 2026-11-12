import { ContractId } from '@hiero-ledger/sdk';

import { callContract } from '@renderer/services/mirrorNodeDataService';
import {
  buildFunctionCallData,
  type ContractCallArgument,
} from '@renderer/utils/sdk/contractFunctionParams';

export interface ContractReference {
  contractId?: string | null;
  evmAddress?: string | null;
}

export function toCallAddress(contract: ContractReference): string {
  if (contract.evmAddress) {
    return contract.evmAddress.startsWith('0x') ? contract.evmAddress : `0x${contract.evmAddress}`;
  }
  if (contract.contractId) {
    return `0x${ContractId.fromString(contract.contractId).toEvmAddress()}`;
  }
  throw new Error('Contract has neither a Contract ID nor an EVM address');
}

/* Accepts either a "0.0.X" Contract ID or a raw "0x..." EVM address - ContractId.fromString
 * only understands the shard.realm.num form, so a bare EVM address needs fromEvmAddress instead. */
export function parseContractReference(idOrEvmAddress: string): ContractId | null {
  const trimmed = idOrEvmAddress.trim();

  if (/^\d+\.\d+\.\d+$/.test(trimmed)) {
    try {
      return ContractId.fromString(trimmed);
    } catch {
      return null;
    }
  }

  const hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
  if (/^[0-9a-fA-F]{40}$/.test(hex)) {
    try {
      return ContractId.fromEvmAddress(0, 0, `0x${hex}`);
    } catch {
      return null;
    }
  }

  return null;
}

/* Inverse of parseContractReference: a ContractId built via fromEvmAddress stringifies as
 * "shard.realm.<hex>", a form only the SDK itself understands - round-tripping that through
 * parseContractReference (and anything built on it, like findMatchingSavedContract) fails. Use
 * the same "0x..." form the rest of the app works with instead. */
export function contractIdToReference(contractId: ContractId): string {
  return contractId.evmAddress != null ? `0x${contractId.toEvmAddress()}` : contractId.toString();
}

interface SavedContractReference {
  contract_id?: string | null;
  evm_address?: string | null;
}

/* Matches a "0.0.X" id or EVM address (as typed by the user, or taken off a transaction) against
 * a list of saved contracts, normalizing both sides to an EVM address first - so a contract saved
 * by one identifier form still resolves when referenced by the other (or by an equivalent but
 * textually different "0.0.X" id, e.g. with a leading zero). */
export function findMatchingSavedContract<T extends SavedContractReference>(
  contracts: T[],
  reference: string,
): T | null {
  const parsed = parseContractReference(reference);
  if (!parsed) {
    return null;
  }
  const targetEvmAddress = parsed.toEvmAddress();

  return (
    contracts.find(c => {
      if (c.contract_id) {
        try {
          if (ContractId.fromString(c.contract_id).toEvmAddress() === targetEvmAddress) {
            return true;
          }
        } catch {
          // not a plain "0.0.X" id - fall through to the evm_address check below
        }
      }
      if (c.evm_address) {
        const saved = c.evm_address.startsWith('0x') ? c.evm_address.slice(2) : c.evm_address;
        if (saved.toLowerCase() === targetEvmAddress.toLowerCase()) {
          return true;
        }
      }
      return false;
    }) || null
  );
}

/* Zero-arg calls only - the shape needed for role getters. Just buildFunctionCallData with no
 * args; kept as its own named function since "zero-arg getter call" is a distinct concept from
 * the general case at every call site that uses it. */
export function buildZeroArgCallData(functionName: string): string {
  return buildFunctionCallData(functionName, []);
}

/* A single bytes32 return value needs no ABI decoding - the raw 32-byte word returned by
 * mirror node's `/contracts/call` already *is* the value. */
export function decodeBytes32Result(resultHex: string): string | null {
  const hex = resultHex.startsWith('0x') ? resultHex.slice(2) : resultHex;
  return hex.length === 64 ? `0x${hex}` : null;
}

export async function resolveBytes32Getter(
  contract: ContractReference,
  functionName: string,
  mirrorNodeLink: string,
): Promise<string | null> {
  const { success, result } = await callContract(
    {
      to: toCallAddress(contract),
      data: buildZeroArgCallData(functionName),
    },
    mirrorNodeLink,
  );

  return success && result ? decodeBytes32Result(result) : null;
}

// 'unknown' (not 'fail') on any network hiccup, so a mirror node blip is never reported as "this
// will fail".
export type ContractCallStatus = 'pass' | 'fail' | 'unknown';

export interface CallSimulationResult {
  status: ContractCallStatus;
  errorMessage?: string;
}

/* Simulates the exact call about to be submitted - same target, function + encoded args, gas
 * limit, and (for payable functions) value, with the fee payer as `from` - via the mirror node's
 * read-only /contracts/call. Catches both business-logic reverts (failed requires, invalid state)
 * and an under-provisioned gas limit (the simulated EVM run reverts the same way a real
 * out-of-gas execution would) before the user ever signs. 'unknown' (not 'fail') on any network
 * issue - a hiccup here should never read as "this call will fail". `valueTinybars` assumes the
 * mirror node's `value` field is tinybars, matching
 * every other numeric field in this REST API (the OpenAPI spec's description for `value` doesn't
 * name a unit) - worth double-checking against a live payable call. */
export async function simulateContractCall(
  contract: ContractReference,
  functionName: string,
  args: ContractCallArgument[],
  options: { valueTinybars?: number; gas?: number; from?: string },
  mirrorNodeLink: string,
): Promise<CallSimulationResult> {
  try {
    const { success, errorMessage } = await callContract(
      {
        to: toCallAddress(contract),
        data: buildFunctionCallData(functionName, args),
        from: options.from,
        gas: options.gas,
        value: options.valueTinybars,
      },
      mirrorNodeLink,
    );
    return success ? { status: 'pass' } : { status: 'fail', errorMessage };
  } catch {
    return { status: 'unknown' };
  }
}
