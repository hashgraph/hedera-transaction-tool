# Data Model for Predefined Reviewer Groups and Entity Assignments

## Summary

Introduce the database schema additions needed to support predefined, reusable reviewer groups that can be assigned to Hedera entities, ad-hoc per-transaction reviewer lists with threshold, and explicit entity tracking on transactions to enable automatic reviewer group resolution.

## Background

Currently, reviewers are assigned manually per-transaction using a self-referential tree structure (`TransactionApprover`). This requires the transaction creator to know and manually assign the correct reviewers every time, which is inefficient and error-prone. There is no mechanism to predefine that "any transaction touching account `0.0.1234` must always be reviewed by the Treasury Board." This sub-issue adds the schema to support that.

The existing `TransactionApprover` entity is fully retired by this sub-issue. Its tree structure, `listId`, threshold fields, and activity columns are all superseded by the new tables introduced here.

## Design Decisions

**Flat group structure with threshold.** Each reviewer group is a flat list of members plus a threshold (minimum number of acceptances required). The multi-level tree behavior is not needed within a single group. Multi-group requirements — where a transaction must satisfy several independent groups — emerge from the many-to-many entity-to-group relationship described below, not from nesting within a single group.

**Many-to-many between entities and groups.** A single group (e.g., "Treasury Board") can be assigned to multiple entities. A single entity can have multiple groups assigned. The `entity_reviewer_group` join table captures this without duplication.

**Snapshot at creation time, not live link.** When a transaction is created, each auto-matched `reviewer_group` is snapshotted into a `transaction_reviewer_list` row — its threshold and current membership are copied at that moment. The predefined group configuration (`reviewer_group`, `reviewer_group_member`, `entity_reviewer_group`) is used only to find matches; after the snapshot is written, subsequent changes to those groups have no effect on the transaction. This preserves a complete, immutable audit record of who was assigned and at what threshold, and eliminates the security risk of an admin modifying a group after a transaction enters review.

## New Tables

### `reviewer_group`

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `name` | string | |
| `description` | string | nullable |
| `threshold` | int | minimum acceptances required; must be ≥ 1 and ≤ member count at time of save; also governs group change attestation |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `reviewer_group_member`

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `group_id` | FK → `reviewer_group` | |
| `user_id` | FK → `user` | |
| `created_at` | timestamp | |

Unique constraint: (`group_id`, `user_id`)

### `entity_reviewer_group`

Many-to-many join between Hedera entities and reviewer groups.

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `hedera_entity_id` | string | e.g., `0.0.12345` |
| `network` | string | mirror network identifier |
| `group_id` | FK → `reviewer_group` | |
| `created_at` | timestamp | |

Unique constraint: (`hedera_entity_id`, `network`, `group_id`)

### `transaction_entity`

Explicit list of Hedera entities affected by a transaction, extracted from SDK transaction bytes at creation time.

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `transaction_id` | FK → `transaction` | |
| `hedera_entity_id` | string | |
| `network` | string | |
| `created_at` | timestamp | |

Entity types to extract include: fee payer account, file ID, topic ID, token ID, transfer senders, transfer receivers, and any other entity directly referenced by the transaction type.

**Node entity distinction:** Hedera has two different node identifiers that must not be conflated. The `nodeAccountId` (e.g., `0.0.3`) is a standard account ID present on every transaction as the fee recipient — it is stored in `0.0.x` format like other accounts. The node ID used in node management transactions (`NodeCreateTransaction`, `NodeUpdateTransaction`, `NodeDeleteTransaction`) is a plain integer with no shard/realm prefix. These must be stored distinctly in `entity_reviewer_group` so that a group assigned to node account `0.0.3` does not inadvertently match node ID `3`. The exact storage format for node IDs (e.g., a `node:3` prefix convention) is an open implementation detail.

Unique constraint: (`transaction_id`, `hedera_entity_id`, `network`) — an entity that appears in multiple roles within the same transaction (e.g., fee payer and transfer sender) is stored as a single row.

### `transaction_reviewer_list`

Per-transaction reviewer list. A transaction has one list per auto-matched `reviewer_group` (snapshotted at creation time) plus at most one list for additionally added reviewers. Lists are never deleted — they form a permanent audit record of who was required to review and at what threshold.

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `transaction_id` | FK → `transaction` | |
| `name` | string, nullable | snapshotted from `reviewer_group.name` at creation time for auto-matched lists; null for additional reviewers |
| `description` | string, nullable | snapshotted from `reviewer_group.description` at creation time for auto-matched lists; null for additional reviewers |
| `threshold` | int | copied from `reviewer_group.threshold` at snapshot time, or set by creator for additional reviewer lists; must be ≥ 1 and ≤ member count at time of save |
| `created_at` | timestamp | |

`name` and `description` are snapshotted — not referenced from the live group — so that history views can display the group's name and purpose exactly as they were when the transaction was created, regardless of subsequent renames, description edits, or soft-deletion of the original group.

All list rows for a transaction are written atomically in the same database transaction as the parent `transaction` row.

### `transaction_reviewer_list_member`

Combines assignment and activity into a single row. Created at transaction creation time (assignment phase); `user_key_id`, `signature`, `accepted`, and `actioned_at` are null until the user acts.

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `list_id` | FK → `transaction_reviewer_list` | |
| `user_id` | FK → `user` | |
| `user_key_id` | FK → `user_key`, nullable | set on action; stored for cryptographic audit only |
| `signature` | bytes, nullable | set on action; stored for cryptographic audit only |
| `accepted` | boolean, nullable | null = pending, true = accepted, false = rejected |
| `note` | string, nullable | reviewer's note; visible to all parties; typically set on rejection but allowed on acceptance |
| `actioned_at` | timestamp, nullable | set on action |
| `created_at` | timestamp | |

Unique constraint: (`list_id`, `user_id`)

## Local Client State

Reviewer groups and member public keys are stored locally on each client machine and are not trusted from the backend at runtime.

**Local snapshot store.** Each client maintains a local store of the most recent verified snapshot for each `reviewer_group`: name, description, threshold, member list, and each member's public key(s). This local store is the authoritative source the client uses to verify incoming review activity.

**Backend as review record.** The backend is the source of recorded reviews (`transaction_reviewer_list` and `transaction_reviewer_list_member` rows). The frontend fetches these rows and verifies them locally — matching signatures against the locally-stored public keys for the group members at the time of the snapshot — before treating them as valid.

**Group change attestation.** When a reviewer group changes (membership or threshold), the backend delivers the new group snapshot together with an attestation: a payload signed by a threshold of the current group's members, using the keys the client already holds locally. The client verifies that the attestation meets the threshold before replacing its local snapshot with the new one. The same `threshold` value governs both review acceptance and group change attestation — no separate column is needed.

**Attestation chain for offline clients.** If a client missed multiple sequential group changes while offline, the backend must supply the full chain of intermediate snapshots and attestations — not just the latest state — so the client can verify each hop in sequence. A client cannot skip from snapshot N to snapshot N+2 without first verifying N→N+1 using N's keys, then N+1→N+2 using N+1's keys.

**Trust On First Use.** When a client encounters a group it has no local record of, or when a brand new user connects for the first time, it must trust whatever the backend provides as the initial state. This is the fundamental trust boundary: after initial trust is established, all subsequent changes require verifiable attestation.

## Retirement of TransactionApprover

The existing `TransactionApprover` entity is fully replaced by `transaction_reviewer_list_member`. The old table conflated policy (tree structure, listId, threshold) and activity (signature, accepted) and was key-based rather than user-based. The new design separates predefined group configuration from per-transaction assignment, and unifies assignment and activity into a single row per member per list.

**Threshold evaluation** is straightforward: for each `transaction_reviewer_list` on the transaction, count `transaction_reviewer_list_member` rows where `accepted = true`. If that count meets or exceeds `threshold`, the list is satisfied. All lists must be satisfied for the transaction to advance. Evaluation is user-based — `user_id`, not `user_key_id`.

**Key selection** happens automatically at action time: the system selects the user's first valid (non-deleted, active) org key, signs the transaction bytes, and writes `user_key_id`, `signature`, `accepted`, `note`, and `actioned_at` onto the member row. `user_key_id` and `signature` are stored for cryptographic audit only and are not surfaced in the UI; `note` is visible to all parties when set.

**Multi-list membership:** a user who appears in more than one list on the same transaction (e.g., they were a member of two auto-matched groups at snapshot time) has a separate `transaction_reviewer_list_member` row in each list. When they act, all their pending rows across all lists are updated in the same operation — they sign once, and all lists they belong to are credited.
