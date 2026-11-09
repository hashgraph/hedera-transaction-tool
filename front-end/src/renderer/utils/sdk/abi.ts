export interface AbiParameter {
  name: string;
  type: string;
  internalType?: string;
  components?: AbiParameter[];
}

export interface AbiFunctionItem {
  type: 'function';
  name: string;
  inputs: AbiParameter[];
  outputs: AbiParameter[];
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
}

export type AbiItem = AbiFunctionItem | ({ type: string } & Record<string, unknown>);

/*
 * Covers Foundry (`out/<Contract>.sol/<Contract>.json`), Hardhat
 * (`artifacts/.../<Contract>.json`), and Remix exports: all three put the ABI either as the
 * top-level array or under an `abi` key alongside bytecode/metadata.
 */
export function normalizeAbiInput(raw: unknown): AbiItem[] | null {
  if (Array.isArray(raw)) {
    return raw as AbiItem[];
  }

  if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).abi)) {
    return (raw as Record<string, unknown>).abi as AbiItem[];
  }

  return null;
}

export function parseAbiJson(text: string): AbiItem[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }

  const abi = normalizeAbiInput(parsed);

  if (!abi) {
    throw new Error(
      'Could not find an ABI in this file (expected a JSON array, or an object with an "abi" field)',
    );
  }

  return abi;
}

export function getAbiFunctions(abi: AbiItem[]): AbiFunctionItem[] {
  return abi.filter((item): item is AbiFunctionItem => item.type === 'function');
}

// Only dynamic arrays (`T[]`) are supported: the SDK's selector builder has no fixed-length form.
// `ContractFunctionParameters` only exposes `addBytes` (dynamic) and `addBytes32` (fixed) -
// there is no addBytes1..addBytes31, unlike every numeric width which has a method per size.
const SUPPORTED_PARAM_TYPE =
  /^(u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|address|bool|bytes(32)?|string)(\[\])?$/;

export function isSupportedAbiParameter(param: AbiParameter): boolean {
  if (param.type.startsWith('tuple')) {
    return false;
  }
  return SUPPORTED_PARAM_TYPE.test(param.type);
}

export function isSupportedAbiFunction(fn: AbiFunctionItem): boolean {
  return fn.inputs.every(isSupportedAbiParameter);
}

// Single 32-byte-word types - the only ones this app can decode back into a display value or a
// draft-reloaded form field without a full ABI head/tail (offset+length) decoder. Arrays, bare
// `bytes`, and `string` are supported for encoding (see isSupportedAbiParameter) but not for
// decoding display, since that needs more than this app currently implements.
export function isStaticAbiParameter(param: AbiParameter): boolean {
  return (
    isSupportedAbiParameter(param) &&
    !param.type.endsWith('[]') &&
    !/\[\d+\]$/.test(param.type) &&
    param.type !== 'string' &&
    param.type !== 'bytes'
  );
}

export function isFullyDecodableAbiFunction(fn: AbiFunctionItem): boolean {
  return fn.inputs.every(isStaticAbiParameter);
}

/* Zero-arg, read-only getters returning a single bytes32 — the shape OpenZeppelin's
 * `bytes32 public constant X_ROLE = keccak256("X_ROLE")` declarations compile to. */
export function getRoleGetterCandidates(abi: AbiItem[]): AbiFunctionItem[] {
  return getAbiFunctions(abi).filter(
    fn =>
      fn.inputs.length === 0 &&
      (fn.stateMutability === 'view' || fn.stateMutability === 'pure') &&
      fn.outputs.length === 1 &&
      fn.outputs[0].type === 'bytes32',
  );
}
