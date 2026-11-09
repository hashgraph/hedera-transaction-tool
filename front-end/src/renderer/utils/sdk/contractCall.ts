import { AccountId, ContractFunctionParameters, ContractId } from '@hiero-ledger/sdk';

import { callContract } from '@renderer/services/mirrorNodeDataService';
import { uint8ToHex } from '@renderer/utils';
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

/* Zero-arg calls only - the only shape needed for role getters (and later `hasRole`, which
 * takes args and will need its own encoding once that's built). Uses the SDK's own selector
 * builder rather than a bundled keccak/ABI library, since it already computes the exact same
 * selector `ContractExecuteTransaction.setFunction()` would. */
export function buildZeroArgCallData(functionName: string): string {
  const bytes = new ContractFunctionParameters()._build(functionName);
  return `0x${uint8ToHex(bytes)}`;
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

export type CallSimulationStatus = 'pass' | 'fail' | 'unknown';

export interface CallSimulationResult {
  status: CallSimulationStatus;
  errorMessage?: string;
}

/* Simulates the exact call about to be submitted - same target, function + encoded args, gas
 * limit, and (for payable functions) value, with the fee payer as `from` - via the mirror node's
 * read-only /contracts/call. Catches both business-logic reverts (failed requires, invalid state)
 * and an under-provisioned gas limit (the simulated EVM run reverts the same way a real
 * out-of-gas execution would) before the user ever signs. 'unknown' (not 'fail') on any network
 * issue, same convention as checkAccountHasRole below - a hiccup here should never read as "this
 * call will fail". `valueTinybars` assumes the mirror node's `value` field is tinybars, matching
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

export type RoleCheckResult = 'pass' | 'fail' | 'unknown';

/* Live `hasRole(role, account)` read via mirror node. 'unknown' (not 'fail') on any error, so a
 * network hiccup is never reported as "account lacks the role". */
export async function checkAccountHasRole(
  contract: ContractReference,
  roleValue: string,
  accountId: string,
  mirrorNodeLink: string,
): Promise<RoleCheckResult> {
  try {
    const data = buildFunctionCallData('hasRole', [
      { name: 'role', type: 'bytes32', value: roleValue },
      {
        name: 'account',
        type: 'address',
        value: `0x${AccountId.fromString(accountId).toEvmAddress()}`,
      },
    ]);
    const { success, result } = await callContract(
      { to: toCallAddress(contract), data },
      mirrorNodeLink,
    );
    if (!success || !result) {
      return 'unknown';
    }
    const hex = result.startsWith('0x') ? result.slice(2) : result;
    return hex.length > 0 && BigInt(`0x${hex}`) !== 0n ? 'pass' : 'fail';
  } catch {
    return 'unknown';
  }
}
