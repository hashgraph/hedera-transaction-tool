# Hedera Transaction Tool — Claude Guidelines

## Error Handling Conventions

**Normalize caught values before accessing `.message`:**
`error instanceof Error ? error : new Error(String(error))`
Applies anywhere caught values are collected into an array or re-thrown as a combined message.

**Log the full error object, not just `error.message`:**
`console.error('context', error)` / `this.logger.warn('context', error)`
Preserves stack trace and non-standard properties for diagnosing outages.

**Collect-then-throw for multi-item loops:**
When iterating accounts/keys that each make a network call, catch individual failures,
accumulate them, and throw once after all items are attempted. Don't fail fast mid-loop —
other items may hit different cached or healthy endpoints.

**Fail-safe on status checks, fail-open on execution:**
If mirror node key resolution fails during status evaluation, keep the transaction's
current status unchanged (don't advance it). If it fails during the execution path
(collation or final submission), skip signature validation and attempt submission anyway —
mirror unavailability does not imply network unavailability.

**Empty `KeyList` is not satisfied:**
`hasValidSignatureKey` must return `false` for a `KeyList` with zero children, regardless
of threshold. `0 >= 0` is a false positive.
