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

export interface AbiConstructorItem {
  type: 'constructor';
  inputs: AbiParameter[];
  stateMutability?: 'nonpayable' | 'payable';
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

export interface StandardJsonSource {
  path: string;
  content: string;
}

export interface StandardJsonSourcesResult {
  sources: StandardJsonSource[];
  // From settings.compilationTarget, e.g. {"WorldClock.sol": "WorldClock"} - picked up by
  // ContractSourceViewer to land on the right file/tab instead of whichever happens to be first.
  contractNameHint: string | null;
}

/*
 * Pulls whatever inline source a solc "Standard JSON Input" shape
 * (https://docs.soliditylang.org/en/latest/using-the-compiler.html#input-description) carries -
 * the same format Sourcify itself accepts for verification, and what `solc --standard-json` /
 * Remix's "compilation details" export produce. Unlike an ABI JSON or solc metadata.json, this
 * embeds the actual source text inline (`sources[path].content`). Never throws - an empty
 * `sources` array just means this particular file had no (or no inline) source, which callers
 * combine with an ABI search rather than treat as fatal on its own.
 */
function extractStandardJsonSources(parsed: unknown): StandardJsonSourcesResult {
  const rawSources =
    parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).sources : undefined;

  const sources: StandardJsonSource[] = [];
  if (rawSources && typeof rawSources === 'object') {
    for (const [path, value] of Object.entries(rawSources as Record<string, unknown>)) {
      const content = (value as Record<string, unknown> | undefined)?.content;
      if (typeof content === 'string') {
        sources.push({ path, content });
      }
    }
  }

  const settings = (parsed as Record<string, unknown> | undefined)?.settings as
    Record<string, unknown> | undefined;
  const compilationTarget = settings?.compilationTarget as Record<string, string> | undefined;
  const contractNameHint = compilationTarget ? (Object.values(compilationTarget)[0] ?? null) : null;

  return { sources, contractNameHint };
}

export function parseStandardJsonSources(text: string): StandardJsonSourcesResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }

  const result = extractStandardJsonSources(parsed);
  if (result.sources.length === 0) {
    throw new Error(
      'This file has no inline source ("sources" entries need a "content" field - solc metadata.json and ABI-only files don\'t carry source text)',
    );
  }

  return result;
}

/*
 * Normalizes a `bytecode` field value into a hex string, or null - shared by the top-level
 * `bytecode` field (Hardhat/Foundry artifacts) and the nested `evm.bytecode` field (raw solc
 * `--standard-json` output), since both wrap the hex the same way: a plain string (Hardhat), or
 * one level deeper under `.object` (Foundry, solc output - alongside `sourceMap`/`linkReferences`,
 * which this ignores). An empty `"0x"` (interfaces/abstract contracts/libraries compile to this)
 * is treated the same as a missing field - there is nothing to deploy.
 */
function normalizeBytecodeField(raw: unknown): string | null {
  let hex: string | null = null;
  if (typeof raw === 'string') {
    hex = raw;
  } else if (raw && typeof raw === 'object') {
    const object = (raw as Record<string, unknown>).object;
    if (typeof object === 'string') {
      hex = object;
    }
  }

  if (hex === null) {
    return null;
  }

  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex;
  return stripped.length > 0 ? hex : null;
}

/*
 * Pulls the creation bytecode ("init code") out of a build artifact's top-level `bytecode` field
 * (Hardhat/Foundry/Remix shape). Never reads `deployedBytecode` - that's the code the contract
 * runs *after* deployment, not the init code ContractCreateTransaction needs.
 */
function extractBytecode(parsed: unknown): string | null {
  return normalizeBytecodeField((parsed as Record<string, unknown> | undefined)?.bytecode);
}

/*
 * Pulls ABI + bytecode out of a raw `solc --standard-json` *compilation output* - not to be
 * confused with the Standard JSON *Input* shape parsed above - its own distinct format:
 * `contracts[sourceFile][contractName] = { abi, evm: { bytecode: { object } } }`, which supports
 * multiple source files and contracts per compile (e.g. `solc --standard-json < input.json`, or
 * Remix's raw compiler output). Only handles the single-contract case: with more than one
 * contract across the whole output, there's no reliable signal here for which one is the
 * deployable target (unlike metadata.json's `settings.compilationTarget`), so this returns null
 * rather than guess - callers fall back to a per-contract artifact (Foundry/Hardhat) instead.
 */
function extractSolcOutputContract(
  parsed: unknown,
): { abi: AbiItem[] | null; bytecode: string | null } | null {
  const contracts = (parsed as Record<string, unknown> | undefined)?.contracts;
  if (!contracts || typeof contracts !== 'object') {
    return null;
  }

  const contractEntries: Record<string, unknown>[] = [];
  for (const perFile of Object.values(contracts as Record<string, unknown>)) {
    if (perFile && typeof perFile === 'object') {
      contractEntries.push(...(Object.values(perFile as Record<string, unknown>) as Record<string, unknown>[]));
    }
  }

  if (contractEntries.length !== 1) {
    return null;
  }

  const [contract] = contractEntries;
  const abi = Array.isArray(contract.abi) ? (contract.abi as AbiItem[]) : null;

  const evm = contract.evm;
  const bytecode =
    evm && typeof evm === 'object'
      ? normalizeBytecodeField((evm as Record<string, unknown>).bytecode)
      : null;

  return { abi, bytecode };
}

export interface ContractArtifact {
  abi: AbiItem[] | null;
  bytecode: string | null;
  sources: StandardJsonSource[];
  contractNameHint: string | null;
}

/*
 * One upload slot, any of three shapes: a raw ABI array/build artifact (Foundry/Hardhat/Remix), a
 * single-contract solc `--standard-json` compilation output, or a solc Standard JSON Input. The
 * first two are compiler *output* (ABI/bytecode) and the last is compiler *input* (source only),
 * so a single file only ever populates one side of this. Callers merge across uploads themselves
 * (keep whichever side a new upload didn't find) so a user can still get both by dropping an
 * ABI/bytecode file and a Standard JSON Input in, one after the other, into the same control.
 */
export function parseContractArtifact(text: string): ContractArtifact {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }

  let abi = normalizeAbiInput(parsed);
  let bytecode = extractBytecode(parsed);
  const { sources, contractNameHint } = extractStandardJsonSources(parsed);

  if (abi === null || bytecode === null) {
    const solcOutput = extractSolcOutputContract(parsed);
    if (solcOutput) {
      abi = abi ?? solcOutput.abi;
      bytecode = bytecode ?? solcOutput.bytecode;
    }
  }

  if (abi === null && bytecode === null && sources.length === 0) {
    throw new Error(
      'Could not find an ABI, bytecode, or source in this file (expected a raw ABI JSON array, ' +
        'a build artifact with an "abi" and/or "bytecode" field, a single-contract solc ' +
        '"--standard-json" output, or a solc "Standard JSON Input" file with inline source)',
    );
  }

  return { abi, bytecode, sources, contractNameHint };
}

export function getAbiFunctions(abi: AbiItem[]): AbiFunctionItem[] {
  return abi.filter((item): item is AbiFunctionItem => item.type === 'function');
}

// At most one constructor per ABI (plain Solidity rule) - null means the no-arg default
// constructor, same as omitting `constructorParameters` on ContractCreateTransaction.
export function getAbiConstructor(abi: AbiItem[]): AbiConstructorItem | null {
  return abi.find((item): item is AbiConstructorItem => item.type === 'constructor') ?? null;
}

// Same "fully encodable/decodable" gate as isCallableAbiFunction - a constructor's args are
// encoded via encodeContractFunctionParams (reusable as-is: it already builds a plain
// ContractFunctionParameters with no selector, exactly what setConstructorParameters needs) and
// decoded via the same head/tail word scheme, so the same type restrictions apply.
export function isConstructorCallable(ctor: AbiConstructorItem): boolean {
  return ctor.inputs.every(isEncodableAbiParameter);
}

// Shared by every call site that reads a SmartContract row's `abi` column (itself the output of
// parseAbiJson, so always either valid JSON or null/undefined) - never throws, [] on anything else.
export function parseStoredAbi(json: string | null | undefined): AbiItem[] {
  if (!json) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as AbiItem[]) : [];
  } catch {
    return [];
  }
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

// Encodable for building a real call ourselves via encodeContractFunctionParams, which (unlike
// the selector builder used for matching) throws on any array type - see contractFunctionParams.ts.
// This is also exactly what decodeContractCall can decode back into a display value: single
// 32-byte-word types directly, plus `string`/`bytes` via their head/tail (offset+length) encoding.
// Used to gate both which functions a user can select to call, and which calls get their
// arguments (not just their name) decoded for display.
export function isEncodableAbiParameter(param: AbiParameter): boolean {
  return isSupportedAbiParameter(param) && !param.type.endsWith('[]');
}

export function isCallableAbiFunction(fn: AbiFunctionItem): boolean {
  return fn.inputs.every(isEncodableAbiParameter);
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
