import { ContractFunctionParameters, ContractFunctionSelector } from '@hiero-ledger/sdk';

import { hexToUint8Array, uint8ToHex } from '@renderer/utils';
import {
  getAbiFunctions,
  isFullyDecodableAbiFunction,
  type AbiFunctionItem,
  type AbiItem,
} from './abi';

export interface ContractCallArgument {
  name: string;
  type: string;
  value: string;
}

export interface DecodedContractCall {
  functionName: string;
  /* null when the function was identified by its selector but has a parameter type (array,
   * string, dynamic bytes) this app doesn't decode back into a display value - see
   * isFullyDecodableAbiFunction. */
  args: { name: string; type: string; value: string }[] | null;
}

function normalizeNumericType(type: string): string {
  if (type === 'uint') return 'uint256';
  if (type === 'int') return 'int256';
  return type;
}

/* Maps an ABI type string directly onto the SDK's `add<Type>`/`add<Type>Array` method name -
 * works because the SDK names every method after the exact Solidity type it adds. */
function resolveMethodName(type: string): string {
  // Only dynamic arrays (`T[]`) have a selector method; a fixed `T[n]` is a different canonical
  // signature, so it falls through to "Unsupported" instead of silently hashing as `T[]`.
  const arrayMatch = type.match(/^(.+)\[\]$/);
  const base = normalizeNumericType(arrayMatch ? arrayMatch[1] : type);
  const suffix = base.charAt(0).toUpperCase() + base.slice(1);
  return arrayMatch ? `${suffix}Array` : suffix;
}

function buildSelectorHex(fn: AbiFunctionItem): string {
  const selector = new ContractFunctionSelector(fn.name);
  const table = selector as unknown as Record<string, () => ContractFunctionSelector>;

  for (const input of fn.inputs) {
    const method = table[`add${resolveMethodName(input.type)}`];
    if (typeof method !== 'function') {
      throw new Error(`Unsupported parameter type: ${input.type}`);
    }
    method.call(selector);
  }

  return uint8ToHex(selector._build());
}

export function encodeContractFunctionParams(
  args: ContractCallArgument[],
): ContractFunctionParameters {
  const params = new ContractFunctionParameters();
  const table = params as unknown as Record<string, (value: unknown) => ContractFunctionParameters>;

  for (const arg of args) {
    if (/\[\d*\]$/.test(arg.type)) {
      throw new Error(`Array parameters are not supported yet: ${arg.name} (${arg.type})`);
    }

    const method = table[`add${resolveMethodName(arg.type)}`];
    if (typeof method !== 'function') {
      throw new Error(`Unsupported parameter type: ${arg.type}`);
    }

    if (arg.type === 'bool') {
      method.call(params, arg.value === 'true');
    } else if (arg.type === 'address' || arg.type === 'string') {
      method.call(params, arg.value);
    } else if (arg.type === 'bytes32' || arg.type === 'bytes') {
      method.call(params, hexToUint8Array(arg.value));
    } else {
      // uint*/int* - the SDK accepts a plain numeric string directly (see its own
      // convertToBigNumber), so there's no need to construct a BigNumber here ourselves.
      method.call(params, arg.value);
    }
  }

  return params;
}

/* False while any argument is still empty/malformed (e.g. right after picking a function, before
 * the user has typed anything) - the SDK throws on those, so callers use this to avoid encoding. */
export function areContractCallArgsEncodable(args: ContractCallArgument[]): boolean {
  try {
    encodeContractFunctionParams(args);
    return true;
  } catch {
    return false;
  }
}

function getIntBits(normalizedType: string): number | null {
  const match = normalizedType.match(/^(?:u?int)(\d+)$/);
  return match ? Number(match[1]) : null;
}

/* Strips characters that can never be valid for the given ABI type as the user types, rather
 * than only flagging them after the fact (see validateFunctionArgValue) - same "strip on input"
 * idiom used elsewhere in this app for restricted fields (e.g. NodeFormData's port inputs,
 * RoleModal's hex sanitizer). Doesn't fully validate (e.g. a too-long hex string or an
 * out-of-range int still passes through here) - that's still validateFunctionArgValue's job. */
export function sanitizeFunctionArgInput(type: string, value: string): string {
  if (type === 'address') {
    return value.toLowerCase().replace(/[^0-9a-fx]/g, '').slice(0, 42);
  }

  if (type === 'bytes32') {
    return value.toLowerCase().replace(/[^0-9a-fx]/g, '').slice(0, 66);
  }

  const normalized = normalizeNumericType(type);
  if (getIntBits(normalized) !== null) {
    const stripped = value.replace(/[^0-9-]/g, '');
    if (!normalized.startsWith('int')) {
      // unsigned - no minus sign allowed at all
      return stripped.replace(/-/g, '');
    }
    // signed - a minus is only meaningful as the very first character
    const isNegative = stripped.startsWith('-');
    return (isNegative ? '-' : '') + stripped.replace(/-/g, '');
  }

  return value;
}

/* True prevention (not just correction) for a single keystroke - pairs with
 * sanitizeFunctionArgInput, which only catches what slips through this (e.g. paste), same as
 * AppHbarInput's handleKeyDown pairs with its own paste-time correction. `key`/`currentValue`
 * are the raw KeyboardEvent.key and the input's value before this keystroke is applied. */
export function isAllowedFunctionArgKey(type: string, key: string, currentValue: string): boolean {
  if (type === 'address' || type === 'bytes32') {
    return /^[0-9a-fA-Fx]$/.test(key);
  }

  const normalized = normalizeNumericType(type);
  if (getIntBits(normalized) === null) {
    return true;
  }

  if (/^[0-9]$/.test(key)) {
    return true;
  }

  // a minus is only ever allowed once, for a signed type
  return normalized.startsWith('int') && key === '-' && !currentValue.includes('-');
}

/* Per-field validation for a single ABI-typed argument, for inline form feedback - distinct from
 * areContractCallArgsEncodable, which only catches what the SDK itself throws on (malformed hex,
 * wrong byte length). The SDK's addUint.../addInt... methods never range-check (see
 * util.convertToBigNumber), so an out-of-range value would otherwise encode "successfully" into
 * a wrong/wrapped word. */
export function validateFunctionArgValue(type: string, value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return 'This field is required';
  }

  if (type === 'address') {
    const hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
    return /^[0-9a-fA-F]{40}$/.test(hex) ? null : 'Must be a 40-character hex address (0x...)';
  }

  if (type === 'bytes32') {
    const hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
    return /^[0-9a-fA-F]{64}$/.test(hex) ? null : 'Must be 32 bytes (64 hex characters)';
  }

  const normalized = normalizeNumericType(type);
  const bits = getIntBits(normalized);
  if (bits !== null) {
    if (!/^-?\d+$/.test(trimmed)) {
      return 'Must be a whole number';
    }

    const parsed = BigInt(trimmed);
    const signed = normalized.startsWith('int');
    const max = signed ? (1n << BigInt(bits - 1)) - 1n : (1n << BigInt(bits)) - 1n;
    const min = signed ? -(1n << BigInt(bits - 1)) : 0n;

    if (parsed < min || parsed > max) {
      return `Must be between ${min} and ${max}`;
    }
  }

  return null;
}

/* Full calldata (selector + encoded args) for a non-zero-arg call - used for the online
 * hasRole(role, account) safety-net check. See contractCall.ts's buildZeroArgCallData for the
 * zero-arg case (role getters), kept separate since it predates this and is already in use. */
export function buildFunctionCallData(functionName: string, args: ContractCallArgument[]): string {
  const params = encodeContractFunctionParams(args);
  return `0x${uint8ToHex(params._build(functionName))}`;
}

function decodeWord(word: Uint8Array, type: string): string {
  if (type === 'address') {
    return `0x${uint8ToHex(word.slice(12))}`;
  }
  if (type === 'bool') {
    return word.some(b => b !== 0) ? 'true' : 'false';
  }
  if (type === 'bytes32') {
    return `0x${uint8ToHex(word)}`;
  }

  let value = BigInt(`0x${uint8ToHex(word)}`);
  if (type.startsWith('int') && (word[0] & 0x80) !== 0) {
    value -= BigInt(2) ** BigInt(256);
  }
  return value.toString();
}

/* Identifies a call's function by matching the leading 4-byte selector against the ABI - this
 * works even for functions with array/string/dynamic-bytes params, since the selector only
 * encodes type names, not values. Arg values are only decoded when every param is a single
 * 32-byte-word type (see isFullyDecodableAbiFunction); otherwise `args` comes back null. */
export function decodeContractCall(
  abi: AbiItem[],
  functionParameters: Uint8Array,
): DecodedContractCall | null {
  if (functionParameters.length < 4) {
    return null;
  }

  const selectorHex = uint8ToHex(functionParameters.slice(0, 4));

  for (const fn of getAbiFunctions(abi)) {
    let candidateSelector: string;
    try {
      candidateSelector = buildSelectorHex(fn);
    } catch {
      continue;
    }

    if (candidateSelector !== selectorHex) {
      continue;
    }

    if (!isFullyDecodableAbiFunction(fn)) {
      return { functionName: fn.name, args: null };
    }

    const args: { name: string; type: string; value: string }[] = [];
    let offset = 4;
    for (const input of fn.inputs) {
      args.push({
        name: input.name,
        type: input.type,
        value: decodeWord(functionParameters.slice(offset, offset + 32), input.type),
      });
      offset += 32;
    }

    return { functionName: fn.name, args };
  }

  return null;
}
