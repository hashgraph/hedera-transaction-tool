# Plan: ContractCreateTransaction support

Working plan for issue #3720. Builds directly on the Smart Contracts registry and ABI/encode-decode
machinery added in #3718 (Contract Execute) - see `docs/contract-execute-plan.md` for that history.
Safe/Timelock wrapping remains out of scope here too; see `docs/contract-execute-safe-timelock.md`.

## Status (2026-11-16)

On branch `3720-add-contract-create`. Done: Step 0 (oversized-bytecode size check), Step 1
(bytecode/constructor-args input parsing, plus an extra single-contract `solc --standard-json`
output shape added along the way), Step 2 (create form), Step 3 (details view), and Step 4
(back-end touchpoints). Not yet committed. See "Known upstream SDK gap" below before touching
`getContractCreateData`, `ContractCreateDetails.vue`'s bytecode display, or the oversized-bytecode
check in `transactions.service.ts`.

Still open: nothing front-end is registered anywhere yet (no entry in
`txTypeComponentMapping.ts` - either the Create or Details one - `TransactionSelectionModal.vue`,
`TransactionBrowserPage.vue`'s instanceof chain - that's Step 5), so neither front-end component
can actually be reached in the running app yet, only exercised via their own component tests. The
back-end model/enum/factory registration from Step 4 is independently complete and testable now.

## Known upstream SDK gap: inline bytecode doesn't survive `Transaction.fromBytes()`

`ContractCreateTransaction._fromProtobuf()` in `@hiero-ledger/sdk` never restores the `bytecode`
field - every other field (including `bytecodeFileId`, `constructorParameters`) is restored, but
`bytecode` is silently omitted. Already found and fixed upstream: issue
[hiero-sdk-js#4659](https://github.com/hiero-ledger/hiero-sdk-js/issues/4659), fix
[hiero-sdk-js#4660](https://github.com/hiero-ledger/hiero-sdk-js/pull/4660), merged 2026-11-11 -
**not in a published release yet** (our installed `2.90.1`, and the newest tag `2.91.0`, both
predate it). Revisit once a release containing it ships and we bump the dependency.

Verified impact (reproduced directly against the installed SDK via ad hoc scripts, not committed):
- **Actual signed/submitted bytes are unaffected.** A frozen transaction's wire bytes are cached at
  freeze time and never regenerated from the (buggy) mutable fields on a plain `.toBytes()` /
  `.execute()` call, confirmed by decoding the raw protobuf before and after a round trip - byte-
  for-byte identical, `initcode` intact both times. Contracts deploy with the correct bytecode.
- **`getContractCreateData`'s read-back is degraded**: `transaction.bytecode` is `null` after
  `Transaction.fromBytes()` (e.g. reopening a draft, viewing details on an unsubmitted multi-sig
  transaction), so `bytecodeHex` comes back empty instead of the real hex. Left as-is (no
  workaround) per team decision - see the comment on `getContractCreateData` in `getData.ts`. This
  starts working correctly the moment the dependency is bumped, no code change needed on our side.
- **Reopening a saved draft actually loses the bytecode, not just display**: `BaseDraftLoad.vue`
  loads a draft via `Transaction.fromBytes()` and emits it; the create form's own `draft-loaded`
  handler then does `Object.assign(data, getContractCreateData(transaction))`, overwriting the
  live reactive form data - so `data.bytecodeHex` goes from whatever it was to `''` in place.
  **Mitigation (temporary, remove once the SDK dependency is bumped past hiero-sdk-js#4660):** the
  create form's `draft-loaded` handler must detect "just reloaded a draft, `bytecodeSource` is
  `'inline'`, recovered `bytecodeHex` is empty" and show a message under the bytecode upload
  control telling the user to re-upload the bytecode artifact before creating - not just a silent
  empty field, since clicking Create with neither `bytecode` nor `bytecodeFileId` set would build
  an invalid transaction. Mark this check clearly in code as temporary/to-remove.
- **A real, separate back-end gap**: `isTransactionBodyOverMaxSize()`
  (`back-end/libs/common/src/utils/sdk/transaction.ts`, used by
  `transactions.service.ts`'s `validateAndPrepareTransaction` to reject oversized transactions at
  upload time) calls the SDK's `_makeTransactionBody()`, which *does* regenerate the body from the
  same broken mutable fields - so for a `ContractCreateTransaction` with inline bytecode that went
  through a `fromBytes()` cycle, this check always measures a body missing the bytecode and never
  flags one as oversized, no matter how large it actually is. Confirmed this is bounded, not a
  security hole: the *other* size check, `isTransactionOverMaxSize` (used right before execution,
  reconstructs the literal outgoing per-node wire message from the cached `SignedTransaction`, not
  from mutable fields - verified by reading `_makeRequestAsync()`/`_buildTransaction()`) is
  unaffected and will still correctly reject an actually-oversized one. Worst case: an oversized
  submission is accepted at upload time, potentially collects signatures from real signers, then
  fails late (at execution) instead of being rejected cleanly upfront. Decision: leave
  `isTransactionBodyOverMaxSize` as-is, no workaround - its "check body size independent of
  signatures collected so far" design is correct and will resume working once the dependency is
  bumped; the front-end's own Step 0 size check already prevents a normal client from ever hitting
  this gap in practice.

Note beyond the original Step 1 scope: `parseContractArtifact` also now understands raw
single-contract `solc --standard-json` compilation output (`contracts[file][name] = { abi, evm: {
bytecode: { object } } }`) - a real shape produced by plain `solc --standard-json` / Remix's raw
compiler output, distinct from both Foundry/Hardhat's flattened per-contract artifacts and the
Standard JSON *Input* shape. Multi-contract output is not disambiguated (no reliable signal for
which contract is the deploy target) and returns null rather than guessing. This also benefits the
registry's existing "Add smart contract" page for free, since it shares `parseContractArtifact`.

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

## Step 0: oversized-bytecode size check (done)

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

## 1. Bytecode + constructor args input (done)

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

## 2. Create form (done)

`Transaction/Create/ContractCreate/`: `ContractCreate.vue` (orchestrator, mirrors
`ContractExecute.vue`) + `ContractCreateFormData.vue`. One artifact upload control
(`parseContractArtifact`) supplies ABI + bytecode + source together; bytecode source toggle
(inline vs. existing File ID); oversized-bytecode message (Step 0) pointing at
FileCreate/FileAppend; admin key via `KeyField`; gas, initial balance, contract memo, max
automatic token associations, auto-renew account, staking fields (mirrors `AccountDataFormData`'s
staking block); constructor-args dynamic form (mirrors `ContractExecuteFormData`'s function-args
form, pointed at the ABI's `constructor` entry instead of a selected function); contract source
display (`ContractSourceViewer.vue`). No auto-renew *period* field - same precedent as
`AccountCreateTransaction`, which also leaves it at the SDK default rather than exposing it.

Decided (not in the original Step 2 bullet list): the artifact-upload handler must prefer
decoding `rawConstructorParametersHex` against a freshly-(re)uploaded ABI over blindly resetting
to blank fields, specifically for the "reloaded draft, re-uploaded the same artifact" case - doing
the reset unconditionally silently discarded a decodable reload. See
`ContractCreateFormData.vue`'s `handleArtifactFileUpdate`.

## 3. Details + signing (done)

`ContractCreateDetails.vue`: new-contract-id resolution + "Link Contract" button (mirrors
`AccountDetails.vue`'s `handleLinkEntity`/entity-id lookup pattern), admin key display (mirrors
`AccountDetails.vue`'s key block: `KeyList` → `KeyStructureModal`, `PublicKey` → formatted with
owner lookup, else → `KeyComponent`, plus an explicit "will be immutable" message when unset),
bytecode (File ID when file-sourced; see "Known upstream SDK gap" for the inline case - always
degraded here, not just on reload, since Details only ever receives an already-deserialized
transaction), gas/initial balance/memo/auto-renew account/max-automatic-token-associations/staking,
and decoded constructor parameters (mirrors `ContractExecuteDetails.vue`'s decode pattern, matched
against a saved contract found by the *resolved* contract id, since there's nothing to match
against before execution).

Deviated from the plan's literal wording ("save into the Smart Contracts registry" implying a
one-click save like `AccountDetails.vue`'s `handleLinkEntity`): `SmartContract.abi` is a required
(non-nullable) column, and there's no UI anywhere to edit a saved contract's ABI after creation
(`SmartContracts.vue` only supports editing nickname/roles) - so a one-click save with a placeholder
empty ABI would create a permanently half-broken registry entry. Instead, "Link Contract" navigates
to the existing `addSmartContract` route with the resolved id pre-filled via a new
`route.query.identifier` read in `AddSmartContract.vue` (same pattern as `FileContents.vue`'s
`route.query.fileId`), reusing that page's already-built Sourcify-lookup + manual-ABI-upload flow
instead of duplicating it.

## 4. Back-end touchpoints (done)

- `TransactionType.CONTRACT_CREATE` enum entry + `getTransactionTypeEnumValue()` branch
  (`back-end/libs/common/src/database/entities/transaction.entity.ts`,
  `back-end/libs/common/src/utils/sdk/transaction.ts`).
- `ContractCreateTransactionModel` (`back-end/libs/common/src/transaction-signature/model/`)
  overriding `getNewKeys()` to return `[adminKey]` when set, registered in that directory's
  `index.ts` and `transaction-factory.ts` - mirrors `FileCreateTransactionModel`'s precedent.

## 5. Registration checklist (not started)

Both `txTypeComponentMapping.ts` (Create + Details), both `transaction-factory.ts` (front-end +
back-end), `TransactionSelectionModal.vue`, `TransactionBrowserPage.vue`'s instanceof chain, back-end
`TransactionType` enum + `getTransactionTypeEnumValue()`, signature models front/back,
`createTransactions.ts`/`getData.ts`.

## Open / not yet done

- Everything past Step 0.
- Whether `isCallableAbiFunction`'s "fully decodable" gate should also restrict which contracts'
  constructors can be used (same call as Contract Execute's function-selection gate).
