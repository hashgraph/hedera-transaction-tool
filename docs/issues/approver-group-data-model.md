# Data Model for Predefined Approver Groups and Entity Assignments

## Summary

Introduce the database schema additions needed to support predefined, reusable approver groups that can be assigned to Hedera entities, ad-hoc per-transaction approver lists with threshold, and explicit entity tracking on transactions to enable automatic approver group resolution.

## Background

Currently, approvers are assigned manually per-transaction using a self-referential tree structure (`TransactionApprover`). This requires the transaction creator to know and manually assign the correct approvers every time, which is inefficient and error-prone. There is no mechanism to predefine that "any transaction touching account `0.0.1234` must always be approved by the Treasury Board." This sub-issue adds the schema to support that.

The existing `TransactionApprover` entity is fully retired by this sub-issue. Its tree structure, `listId`, threshold fields, and activity columns are all superseded by the new tables introduced here.

## Design Decisions

**Flat group structure with threshold.** Each approver group is a flat list of members plus a threshold (minimum number of approvals required). The multi-level tree behavior is not needed within a single group. Multi-group requirements — where a transaction must satisfy several independent groups — emerge from the many-to-many entity-to-group relationship described below, not from nesting within a single group.

**Many-to-many between entities and groups.** A single group (e.g., "Treasury Board") can be assigned to multiple entities. A single entity can have multiple groups assigned. The `entity_approver_group` join table captures this without duplication.

**Snapshot at creation time, not live link.** When a transaction is created, each auto-matched `approver_group` is snapshotted into a `transaction_approver_list` row — its threshold and current membership are copied at that moment. The predefined group configuration (`approver_group`, `approver_group_member`, `entity_approver_group`) is used only to find matches; after the snapshot is written, subsequent changes to those groups have no effect on the transaction. This preserves a complete, immutable audit record of who was assigned and at what threshold, and eliminates the security risk of an admin modifying a group after a transaction enters review.

## New Tables

### `approver_group`

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `name` | string | |
| `description` | string | nullable |
| `threshold` | int | minimum approvals required; must be ≥ 1 and ≤ member count at time of save |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `approver_group_member`

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `group_id` | FK → `approver_group` | |
| `user_id` | FK → `user` | |
| `created_at` | timestamp | |

Unique constraint: (`group_id`, `user_id`)

### `entity_approver_group`

Many-to-many join between Hedera entities and approver groups.

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `hedera_entity_id` | string | e.g., `0.0.12345` |
| `network` | string | mirror network identifier |
| `group_id` | FK → `approver_group` | |
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

**Node entity distinction:** Hedera has two different node identifiers that must not be conflated. The `nodeAccountId` (e.g., `0.0.3`) is a standard account ID present on every transaction as the fee recipient — it is stored in `0.0.x` format like other accounts. The node ID used in node management transactions (`NodeCreateTransaction`, `NodeUpdateTransaction`, `NodeDeleteTransaction`) is a plain integer with no shard/realm prefix. These must be stored distinctly in `entity_approver_group` so that a group assigned to node account `0.0.3` does not inadvertently match node ID `3`. The exact storage format for node IDs (e.g., a `node:3` prefix convention) is an open implementation detail.

Unique constraint: (`transaction_id`, `hedera_entity_id`, `network`) — an entity that appears in multiple roles within the same transaction (e.g., fee payer and transfer sender) is stored as a single row.

### `transaction_approver_list`

Per-transaction approver list. A transaction has one list per auto-matched `approver_group` (snapshotted at creation time) plus at most one list for additionally added approvers. Lists are never deleted — they form a permanent audit record of who was required to approve and at what threshold.

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `transaction_id` | FK → `transaction` | |
| `name` | string, nullable | snapshotted from `approver_group.name` at creation time for auto-matched lists; null for additional approvers |
| `description` | string, nullable | snapshotted from `approver_group.description` at creation time for auto-matched lists; null for additional approvers |
| `threshold` | int | copied from `approver_group.threshold` at snapshot time, or set by creator for additional approver lists; must be ≥ 1 and ≤ member count at time of save |
| `created_at` | timestamp | |

`name` and `description` are snapshotted — not referenced from the live group — so that history views can display the group's name and purpose exactly as they were when the transaction was created, regardless of subsequent renames, description edits, or soft-deletion of the original group.

All list rows for a transaction are written atomically in the same database transaction as the parent `transaction` row.

### `transaction_approver_list_member`

Combines assignment and activity into a single row. Created at transaction creation time (assignment phase); `user_key_id`, `signature`, `approved`, and `actioned_at` are null until the user acts.

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `list_id` | FK → `transaction_approver_list` | |
| `user_id` | FK → `user` | |
| `user_key_id` | FK → `user_key`, nullable | set on action; stored for cryptographic audit only |
| `signature` | bytes, nullable | set on action; stored for cryptographic audit only |
| `approved` | boolean, nullable | null = pending, true = approved, false = disapproved |
| `actioned_at` | timestamp, nullable | set on action |
| `created_at` | timestamp | |

Unique constraint: (`list_id`, `user_id`)

## Retirement of TransactionApprover

The existing `TransactionApprover` entity is fully replaced by `transaction_approver_list_member`. The old table conflated policy (tree structure, listId, threshold) and activity (signature, approved) and was key-based rather than user-based. The new design separates predefined group configuration from per-transaction assignment, and unifies assignment and activity into a single row per member per list.

**Threshold evaluation** is straightforward: for each `transaction_approver_list` on the transaction, count `transaction_approver_list_member` rows where `approved = true`. If that count meets or exceeds `threshold`, the list is satisfied. All lists must be satisfied for the transaction to advance. Evaluation is user-based — `user_id`, not `user_key_id`.

**Key selection** happens automatically at action time: the system selects the user's first valid (non-deleted, active) org key, signs the transaction bytes, and writes `user_key_id`, `signature`, `approved`, and `actioned_at` onto the member row. These fields are stored for cryptographic audit only and are not surfaced in the UI.

**Multi-list membership:** a user who appears in more than one list on the same transaction (e.g., they were a member of two auto-matched groups at snapshot time) has a separate `transaction_approver_list_member` row in each list. When they act, all their pending rows across all lists are updated in the same operation — they sign once, and all lists they belong to are credited.
