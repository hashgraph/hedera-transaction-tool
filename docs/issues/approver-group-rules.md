# Reviewer Group Assignment Rules

## Summary

Define how reviewer groups are matched to transactions, how the rules that drive that matching are stored and kept trustworthy on the client, and how rule changes are authorized. This sub-issue covers both the current entity-based matching model and the framework for adding richer rule types in the future.

## Background

`approver-group-data-model.md` introduces the `entity_reviewer_group` join table and defers the question of rule change attestation to an open question. `approver-group-workflow.md` notes that the client resolves entity-to-group matches from its local store rather than querying the API at transaction creation time. This document specifies what is in that local store, how it is updated, how updates are authorized, and how matching works.

## Current Rule Type: Entity-to-Group Mappings

The only rule type in the initial implementation is a direct mapping: a specific Hedera entity (identified by `hedera_entity_id` + `network`) is associated with a reviewer group. When a transaction is created, any entity extracted from the transaction bytes that has a mapping triggers that group's snapshot to be added to the transaction.

This is stored in `entity_reviewer_group`:

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `hedera_entity_id` | string | e.g., `0.0.12345` |
| `network` | string | mirror network identifier |
| `group_id` | FK → `reviewer_group` | |
| `created_at` | timestamp | |

Admins manage these mappings through the org settings UI alongside the reviewer groups themselves. One entity can have multiple groups mapped to it; one group can be mapped to multiple entities.

## Local Store

The client's local store includes all current `entity_reviewer_group` mappings alongside the group snapshots described in `approver-group-data-model.md`. At transaction creation time, the client resolves entity-to-group matches entirely from this local store — no API call is made. This prevents a compromised backend from silently suppressing or injecting review requirements by manipulating the API response at the moment of transaction creation.

**Initial sync.** On first connection to an org, the backend delivers the full current set of mappings. As with group snapshots, this initial delivery is Trust On First Use — the client has no prior baseline to verify against. New users should verify the initial rule set out-of-band with their org admin.

**Incremental updates.** When mappings change, the backend delivers the delta (additions and removals) to connected clients. Each update must be accepted before the client's local store reflects the change. The authorization model for accepting updates is described in the next section.

**Offline clients.** If a client was offline while multiple mapping changes occurred, the backend must supply the full ordered sequence of changes — not just the current state — so the client can apply and verify them in order.

## Rule Change Attestation

This is the primary open design question for this sub-issue.

**The attack.** An admin removes an entity-to-group mapping, creates a transaction that would have required review, then re-adds the mapping. The transaction bypasses review and the mapping history appears clean. Without attestation, the backend can do this silently and the client's local store will follow along.

**Why group attestation doesn't directly apply.** Group changes (membership, threshold) are attested by a threshold of the group's own members, using keys the client already holds locally. Rule changes don't have an equivalent self-attesting party. The entity being mapped has no key material; the group being mapped could sign, but requiring Treasury Board approval every time an admin assigns a new account to them is operationally awkward.

**Options under consideration:**

1. **Org admin key.** Each org has a designated admin keypair. The admin's public key is stored in the client's local store (itself TOFU on first connection). Every rule change — addition or removal — must be signed by the admin key before the client accepts it. Simple, but a single compromised admin key can manipulate all rules unilaterally.

2. **Admin quorum.** Same as option 1, but requires N-of-M admin keys. The org configures an admin group with its own threshold. Rule changes require that quorum to sign. Prevents a single admin from bypassing rules unilaterally; matches the threshold model used for reviewer groups themselves.

3. **Append-only signed log.** Don't require attestation to accept changes, but all changes are signed by the admin and written to an immutable log that clients retain locally. Rule removals are permanently visible in the log alongside who authorized them and when. This does not prevent the attack but makes it detectable and attributable after the fact. Can be combined with option 1 or 2.

4. **HCS rule log.** Rule changes are posted as messages to the org's HCS topic (see `hcs-upgrade-approval.md` for the org-level topic pattern). The Hedera network enforces `submitKey` restrictions; the mirror node makes the full history freely and independently queryable. The initial topic ID is still TOFU, but subsequent changes are tamper-evident without trusting the backend. This is the strongest option but adds operational complexity.

**Recommended direction (unresolved).** Option 2 (admin quorum) for authorization, combined with option 3 (append-only signed log) for auditability, is the most defensible baseline. Option 4 (HCS) is the strongest but should be considered alongside the broader on-chain trust discussion rather than in isolation. No option is closed; this remains an open question.

## Matching and Precedence

**All matched rules apply.** When a transaction is created, every entity-to-group mapping that matches any extracted entity contributes its group to the transaction's reviewer lists. There is no priority ordering between rules — they are additive. All matched group thresholds must be satisfied for the transaction to advance.

**No exclusions.** One rule cannot suppress another. If two different rules both match and both resolve to the same group, that group appears once in the transaction (not twice) — the deduplication is on `group_id` at snapshot time.

**Creator exclusion applies per list.** As specified in `approver-group-workflow.md`, the transaction creator is excluded from reviewer lists even if they are a member of a matched group. This exclusion is applied after matching, not during rule evaluation.

## Future Rule Types

The entity-to-group mapping is the first and simplest rule type. The following are explicitly out of scope for the initial implementation but must not be precluded by the schema or local store design.

**Transaction-type-based matching.** A group is triggered by the transaction type regardless of which entities are involved — for example, any `NodeCreateTransaction` requires the Node Governance group. This would require a separate matching table (e.g., `transaction_type_reviewer_group`) evaluated at the same creation-time step alongside entity matching. The local store would include this table's contents.

**Conditional rules.** A rule applies only when a transaction property meets a condition — for example, a transfer over 100 HBAR requires additional review, but a transfer under that threshold does not. Conditions may reference transfer amounts, token quantities, or other extractable transaction properties. Conditions on entity rules and type rules can be combined.

**Combined matching.** A rule may require both a specific entity and a specific transaction type (e.g., "a `CryptoUpdateTransaction` touching account `0.0.1234`"). Precedence and deduplication when multiple combined rules match the same group will need to be defined when this is implemented.

The current `entity_reviewer_group` table and local store design do not preclude any of these extensions. Each new rule type adds a new table and a new matching pass at transaction creation time; the snapshot and threshold evaluation model is unchanged.

## Open Questions

**Rule change attestation model.** Which of the options above (or what combination) provides the right balance of security and operational feasibility for orgs of varying sizes and sophistication? See the attestation section above.

**Rule removal vs. deactivation.** Should removing an entity-from-group mapping be a hard delete or a soft deactivation? Soft deactivation preserves the full mapping history in the database and makes the signed log (option 3) easier to implement and audit. Hard delete is simpler but loses history.

**Admin key bootstrapping.** If admin key attestation is adopted (options 1 or 2), how does the client first learn the admin public key? This is itself a TOFU moment, but one that occurs at org-join time alongside the initial mapping sync — a more controlled context than routine client connections.

**Conflict between rule types (future).** When transaction-type rules and entity rules both match, and they resolve to different groups with conflicting thresholds, is the result additive (all must be met) or is there a precedence rule? The current answer is additive for entity rules; the same assumption should apply across rule types unless there is a specific reason to override it.
