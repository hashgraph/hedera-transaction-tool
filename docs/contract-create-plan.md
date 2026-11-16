# Plan: ContractCreateTransaction support

Working plan for issue #3720. Builds directly on the Smart Contracts registry and ABI/encode-decode
machinery added in #3718 (Contract Execute) - see `docs/contract-execute-plan.md` for that history.
Safe/Timelock wrapping remains out of scope here too; see `docs/contract-execute-safe-timelock.md`.

## Status (2026-11-16)

Just started, on branch `3720-add-contract-create`. First piece being implemented: the oversized-
bytecode size check (see "Step 0" below). Nothing else built yet.

## Scope

In scope:
- `ContractCreateTransaction` create form: inline bytecode (hex paste or Foundry/Hardhat artifact
  upload) or an existing bytecode File ID, admin key, gas, initial balance, auto-renew
  period/account, memo, staking fields, constructor args (ABI-driven).
- Admin key signature requirement in the signature model - protocol-mandated: HAPI's
  `ContractCreateTransactionBody.adminKey` doc states "If this field is set, that key MUST sign
  this transaction." This differs from `ContractExecuteTransactionModel` (no new key involved) and
  from the existing `AccountCreateTransactionModel` (which has no override despite setting a new
  key - not following that precedent here since the protocol requirement is explicit).
- Contract source import on the create form, reusing `parseContractArtifact` +
  `ContractSourceViewer.vue` as-is from the registry's Add page.
- `ContractCreateDetails.vue` for viewing/signing - decode constructor args the same way
  `ContractExecuteDetails.vue` decodes call args. Includes a "Link Contract" button (mirrors
  `AccountDetails.vue`'s `handleLinkEntity`: resolve the real Contract ID via mirror-node entity_id
  lookup by payer+validStart, then save into the Smart Contracts registry) - manual, not automatic.
- Full registration-touchpoint checklist, the same mechanical pattern as #3718: both
  `txTypeComponentMapping.ts` files, both `transaction-factory.ts`, `TransactionSelectionModal.vue`,
  `TransactionBrowserPage.vue`'s instanceof chain, back-end `TransactionType` enum +
  `getTransactionTypeEnumValue()`.
- Oversized-bytecode case: detect and **block transaction creation** with a message telling the
  user to upload via FileCreate/FileAppend first and retry ContractCreate with the resulting File
  ID. No automation of that upload - see "Out of scope" below.

Out of scope (deferred to a follow-up issue):
- Any FileCreate/FileAppend automation or chunk-generation for oversized bytecode. A single
  pre-built atomic group can't reference the real file ID in advance anyway (the file ID doesn't
  exist until FileCreate executes), so this would need a guided two-phase wizard (submit
  FileCreate, wait for the receipt, auto-generate the FileAppend chunks + final ContractCreate) -
  deliberately not attempted in this pass.
- `EthereumTransaction`-based deployment (excluded by the issue itself).
- `ContractUpdateTransaction` / `ContractDeleteTransaction` (still deferred from #3718's scope too).

## Step 0: oversized-bytecode size check (in progress)

A `ContractCreateTransaction` has no chunking mechanism (unlike `FileAppendTransaction`) - its
`bytecode` field is set directly on the transaction body, so it is bounded by the plain Hedera
transaction size limit. `front-end/src/renderer/utils/sdk/privilegedPayer.ts` already has the
HIP-1300 size-limit machinery (`getMaxTransactionSize`, `getMaxChunkSize` with
`APPEND_CHUNK_OVERHEAD_BYTES` for FileAppend's envelope). This step adds the ContractCreate
equivalent: an overhead constant for everything else in a `ContractCreateTransaction` envelope
(adminKey, gas, initialBalance, autoRenewPeriod/Account, memo, staking fields, constructor params,
signatures) and a `getMaxContractBytecodeSize(feePayer)` helper, so the create form can compare the
user's bytecode length against it and block submission with a clear message instead of letting an
oversized transaction fail at signing/submission time.

## 1. Bytecode + constructor args input (not started)

- `abi.ts`: extend `parseContractArtifact` to also pull `bytecode.object` (Foundry/Hardhat shape);
  add `getAbiConstructor(abi)` helper (ABI constructor entries have `type: 'constructor'`, inputs
  only, no name/outputs - not covered by the existing `getAbiFunctions` filter).
- `contractFunctionParams.ts`: `encodeContractFunctionParams` already returns a plain
  `ContractFunctionParameters` (no selector baked in), which is exactly what
  `ContractCreateTransaction.setConstructorParameters()` needs - reusable as-is for encoding. Decode
  needs a small new selector-less variant of `decodeContractCall`'s word-decoding logic, since a
  constructor call has no 4-byte selector to match against.
- Same struct/tuple and "fully-decodable types only" limitations carried over from Contract
  Execute (`isCallableAbiFunction`-equivalent gating on the constructor's inputs).

## 2. Create form (not started)

`Transaction/Create/ContractCreate/`: bytecode source toggle (inline upload vs. existing File ID),
oversized-bytecode block (Step 0), admin key input (reuse `KeyComponent`/key-structure UI from
AccountCreate), gas, initial balance, auto-renew period/account, memo, staking fields, constructor
args dynamic form, contract source import/display (reuse `ContractSourceViewer.vue`).

## 3. Details + signing (not started)

`ContractCreateDetails.vue`: bytecode size/hash, admin key, gas, decoded constructor args, "Link
Contract" button into the Smart Contracts registry (manual, post-execution, per the mirror-node
entity-ID-lookup pattern in `AccountDetails.vue`).

## 4. Back-end touchpoints (not started)

- `TransactionType.CONTRACT_CREATE` enum entry + `getTransactionTypeEnumValue()` branch.
- `ContractCreateTransactionModel` overriding `getNewKeys()` to return `[adminKey]` when set.

## 5. Registration checklist (not started)

Both `txTypeComponentMapping.ts` (Create + Details), both `transaction-factory.ts` (front-end +
back-end), `TransactionSelectionModal.vue`, `TransactionBrowserPage.vue`'s instanceof chain, back-end
`TransactionType` enum + `getTransactionTypeEnumValue()`, signature models front/back,
`createTransactions.ts`/`getData.ts`.

## Open / not yet done

- Everything past Step 0.
- Whether `isCallableAbiFunction`'s "fully decodable" gate should also restrict which contracts'
  constructors can be used (same call as Contract Execute's function-selection gate).
