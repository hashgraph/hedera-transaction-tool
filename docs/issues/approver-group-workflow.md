# Approver Group Management and Transaction Approval Workflow

## Summary

Implement the admin UI and API for creating and managing approver groups, the automatic assignment of approver groups to new transactions based on affected entities, and the enforcement of conditional transaction visibility for signers pending approval.

## Background

With the schema in place (see `approver-group-data-model.md`), this sub-issue covers how approver groups are created and managed by admins, how they are automatically pulled into new transactions at creation time, and how approval status gates signer visibility — addressing the core problems of manual approver assignment and premature transaction exposure.

## Who Can Manage Approver Groups

Org admins only. Regular users can see which groups are assigned to a transaction and their approval status but cannot create, edit, or delete groups or entity assignments.

## Creating and Managing Approver Groups

Admins create approver groups through a new section of the org admin UI. For each group, the admin specifies a name, optional description, threshold, and member list (drawn from the org's user directory). Groups can be assigned to any number of Hedera entities — accounts, files, nodes, topics. One entity can have multiple groups. One group can cover multiple entities. Changes to group membership or threshold take effect immediately across all pending transactions referencing that group, consistent with the live-link design.

## Automatic Approver Assignment on Transaction Creation

When a new transaction is created, the API:

1. Decodes the `transactionBytes` using the Hedera SDK to extract all affected entities
2. Persists those entities to `transaction_entity`
3. Queries `entity_approver_group` for any groups mapped to those entities
4. Those groups automatically become the approval requirements for the transaction — no manual step required from the creator

If no matching entity-group mappings exist, the transaction proceeds without an approval requirement, preserving existing behavior. The creator can still manually assign approvers for transactions where no predefined group applies.

## Conditional Transaction Visibility

A transaction with one or more approver groups assigned is not visible to signers until all group thresholds have been satisfied. The `READY_TO_SIGN` and `IN_PROGRESS` transaction node queries are updated to exclude transactions with unmet approval requirements. Those transactions surface only in the `READY_FOR_REVIEW` collection, where approver group members can act on them. Once all groups have met their threshold, the transaction becomes visible to signers in the normal flow.

## Approval Tracking

When an approver group member submits an approval, their signature is validated against the transaction bytes (same mechanism as the existing `approveTransaction` flow) and recorded. After each approval, the system evaluates whether the group's threshold is satisfied. When all groups assigned to a transaction are satisfied, the transaction advances to signer visibility.

## Feature Flag

This feature ships behind the existing `FEATURE_APPROVERS_ENABLED` flag and is enabled once the full workflow is validated end-to-end.
