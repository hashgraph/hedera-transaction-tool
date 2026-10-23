# Deferred Cleanup

Work we can't do yet, grouped by what unblocks it. Add an entry when you leave a compatibility shim in the code, and delete it once it's done. Code comments should point here instead of carrying their own `TODO`.

## When the minimum supported version is raised

### Creator signature: drop the "unverifiable" legacy state

Older clients signed unfrozen transaction bytes, and the server stored the frozen bytes as `unsignedTransactionBytes`, so those signatures can't be verified. Until then they show as "unverifiable": the details page shows a "Creator Signature" row and signing asks for confirmation (`CreatorSignatureConfirmModal`) instead of being blocked.

Once every supported client signs frozen bytes and the server stores them as received:

- Make `'unverifiable'` block signing in the Sign buttons and `TransactionDetailsHeader.vue` / `TransactionGroupDetails.vue` instead of asking for confirmation, and reword or remove the details page row (`TransactionDetails.vue`).
- Decide what to do with rows created before the change, which will never verify (leave them labeled, or skip the check for finished transactions).
- Remove the `isFrozen()` handling from `parseWithoutSignatures` (`front-end/src/renderer/utils/sdk/index.ts`) if no unfrozen bytes can reach it.

## Next release

Nothing yet.
