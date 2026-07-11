# Data Model for Predefined Approver Groups and Entity Assignments

## Summary

Introduce the database schema additions needed to support predefined, reusable approver groups that can be assigned to Hedera entities, and explicit entity tracking on transactions to enable automatic approver group resolution.

## Background

Currently, approvers are assigned manually per-transaction using a self-referential tree structure (`TransactionApprover`). This requires the transaction creator to know and manually assign the correct approvers every time, which is inefficient and error-prone. There is no mechanism to predefine that "any transaction touching account `0.0.1234` must always be approved by the Treasury Board." This sub-issue adds the schema to support that.

## Design Decisions

**Flat group structure with threshold.** Each approver group is a flat list of members plus a threshold (minimum number of approvals required). The multi-level tree behavior is not needed within a single group. Multi-group requirements — where a transaction must satisfy several independent groups — emerge from the many-to-many entity-to-group relationship described below, not from nesting within a single group.

**Many-to-many between entities and groups.** A single group (e.g., "Treasury Board") can be assigned to multiple entities. A single entity can have multiple groups assigned. The `entity_approver_group` join table captures this without duplication.

**Live link, not snapshot.** Transactions do not copy group membership at creation time. Approval requirements are resolved at query time by walking:

```
Transaction → TransactionEntity → EntityApproverGroup → ApproverGroup → ApproverGroupMember
```

Updating a group's membership immediately reflects on all pending transactions referencing it. If a member is removed after already approving, their signature remains valid. If a member is added while a transaction is pending, they become a required approver going forward.

## New Tables

### `approver_group`

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `name` | string | |
| `description` | string | nullable |
| `threshold` | int | minimum approvals required |
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

Entity types to extract include: fee payer account, file ID, node ID, registered node ID, transfer senders, transfer receivers, and any other entity directly referenced by the transaction type.

## Relationship to Existing TransactionApprover

The existing `TransactionApprover` self-referential tree table is not modified by this sub-issue. Its relationship to the new group-based approval flow is addressed in the implementation sub-issue.
