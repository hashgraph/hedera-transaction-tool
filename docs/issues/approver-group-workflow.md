# Approver Group Management and Transaction Approval Workflow

## Summary

Implement the admin UI and API for creating and managing approver groups, the automatic assignment of approver groups to new transactions based on affected entities, and the enforcement of conditional transaction visibility for signers pending approval.

## Background

With the schema in place (see `approver-group-data-model.md`), this sub-issue covers how approver groups are created and managed by admins, how they are automatically pulled into new transactions at creation time, and how approval status gates signer visibility — addressing the core problems of manual approver assignment and premature transaction exposure.

## Who Can Manage Approver Groups

Org admins only can create, edit, and delete approver groups and entity assignments. All org members can view group names, membership, and threshold — transparency is intentional so anyone can understand why a transaction requires approval and from whom.

## Creating and Managing Approver Groups

Admins create approver groups through a dedicated section of the org settings UI. The org settings UI is slated for a broader overhaul; the approver group management screens should be scoped to that effort rather than bolted onto the current layout. For each group, the admin specifies a name, optional description, threshold, and member list drawn from the org's user directory. Groups can be assigned to any number of Hedera entities — accounts, files, nodes, topics. One entity can have multiple groups. One group can cover multiple entities.

## Transaction Creation UX — Live Group Preview

During transaction creation, as the creator fills in entities (fee payer, sender/receiver accounts, file IDs, etc.), the frontend queries the API to check whether any of those entities have associated approver groups. Matched groups are displayed immediately in the approvers section as a read-only preview, so the creator knows before submitting that an approval requirement will be applied. The creator cannot remove these automatically matched groups from the form.

The creator may also add additional approvers on top of the automatically matched ones. The "Add Approver" modal lets the creator select individual contacts and optionally set a threshold (e.g., 2-of-5 selected contacts must approve). The selected contacts and threshold are stored as a `transaction_approver_list` row. Both automatic groups and the ad-hoc list are independently required — all automatic group thresholds must be met and the ad-hoc list threshold must be met before the transaction advances.

## Automatic Approver Assignment on Transaction Creation

When a new transaction is created, the API:

1. Decodes the `transactionBytes` using the Hedera SDK to extract all affected entities
2. Persists those entities to `transaction_entity`
3. Queries `entity_approver_group` for any groups mapped to those entities
4. For each matched group, creates a `transaction_approver_list` row (copying the group's current `name`, `description`, and `threshold`) and a `transaction_approver_list_member` row for each current group member
5. If the creator added additional approvers, creates one additional `transaction_approver_list` row (no `group_id`) with the selected contacts and threshold as `transaction_approver_list_member` rows
6. All of the above are written atomically in the same database transaction as the `transaction` row itself

If any lists were created, the transaction's initial status is set to `READY_FOR_REVIEW`. The assigned members are notified. Signers are not notified — the transaction is not ready for signing yet.

If no entity-group mappings matched and no additional approvers were added, the transaction proceeds with its normal initial status and signers are notified as usual.

All `transaction_approver_list` and `transaction_approver_list_member` rows are permanent — they are never deleted, even after the transaction reaches a terminal state. They form the complete audit record of who was assigned to approve, at what threshold, and what action (if any) each assignee took.

## Conditional Transaction Visibility

A transaction with one or more approver groups assigned is not visible to signers until all group thresholds have been satisfied. The `READY_TO_SIGN` and `IN_PROGRESS` transaction node queries are updated to exclude transactions with unmet approval requirements. Those transactions surface only in the `READY_FOR_REVIEW` collection, where approver group members can act on them. Once all groups have met their threshold, the transaction becomes visible to signers in the normal flow.

## Approval Tracking

Approving a transaction is an attestation, not a Hedera signature. The approver clicks Approve — the system automatically selects their first valid (non-deleted, active) org key, signs the transaction bytes with it, and submits the result. Key selection is never exposed to the approver. If the user is not using the system keychain, they are prompted for their password to decrypt the key; otherwise the signature is produced silently. If the user has no valid org key, the Approve button is disabled with an explanatory message — no key picker is shown.

When the action is submitted, `user_key_id`, `signature`, `approved`, and `actioned_at` are written onto the approver's `transaction_approver_list_member` row(s). If the user appears in more than one list on the transaction (e.g., they were a member of two auto-matched groups), all their pending rows across all lists are updated in the same operation — one action satisfies all lists simultaneously. The `user_key_id` and `signature` are stored for cryptographic audit only and are not surfaced in the UI.

**Disapproval:** Any single disapproval from any assignee immediately sets the transaction status to `REJECTED`. The transaction moves to history. There is no undo — if the creator wants to proceed, they recreate the transaction from history. The history view should provide a "Recreate" button that pre-populates a new transaction from the rejected one's bytes, starting the full approval flow again.

**Threshold evaluation:** For each `transaction_approver_list` on the transaction, the system counts member rows where `approved = true`. If that count meets or exceeds the list's `threshold`, the list is satisfied. All lists must be satisfied for the transaction to advance. Evaluation is user-based — `user_id`, not `user_key_id`.

When all lists are satisfied, the transaction's status advances and it becomes visible to signers in the normal flow. This status transition happens synchronously within the same API call that recorded the final approval. Once the transaction advances out of `READY_FOR_REVIEW`, no further approval submissions are accepted — the approval phase is closed.

## Group Changes After Transaction Creation

Because approval requirements are snapshotted at creation time, admin changes to an `approver_group` after a transaction is created have no effect on that transaction. The transaction's `transaction_approver_list` rows are immutable. Deleting or modifying the predefined group only affects future transactions.

## Feature Flag

This feature ships behind the existing `FEATURE_APPROVERS_ENABLED` flag and is enabled once the full workflow is validated end-to-end.

## Future Considerations

These capabilities are intentionally out of scope for the initial implementation but must be accounted for in the data model design so they can be added later without a breaking schema change.

**Transaction-type-based approver group assignment.** Currently, groups are assigned to Hedera entities (accounts, files, topics, etc.). A future extension would allow groups to be assigned to transaction types directly — for example, "any `NodeCreateTransaction` requires the Node Governance group, regardless of which entities are involved." This would require a separate matching table (e.g., `transaction_type_approver_group`) alongside the existing `entity_approver_group`, evaluated at the same creation-time step.

**Conditional rules.** A further extension would allow approver group assignment to be conditional on transaction properties — for example, "a transfer over 100 HBAR requires the Treasury Board group, but a transfer under 100 HBAR does not." Conditions are transaction-type-specific (an HBAR amount threshold only applies to transfers), so they would be attached to type-based rules rather than entity-based ones. Condition evaluation happens at transaction creation time when the SDK decodes the bytes.

**Combined matching.** Rules could combine entity, type, and condition — for example, "a transfer to account `0.0.1234` over 100 HBAR requires group X." The resolution order and precedence between overlapping rules (entity-only, type-only, combined) will need to be defined when this is implemented.

The current schema does not preclude any of these — they add new tables and new evaluation steps at creation time without modifying the existing `entity_approver_group` or `transaction_entity` tables.

## Open Questions

These design questions are unresolved and must be decided before implementation begins.

**Live-link as an attack vector** *(resolved)*
- Resolved by snapshotting group membership into `transaction_approver_list` at transaction creation time. Group changes after creation have no effect on pending transactions. The predefined group configuration is used only to find matches; the snapshot owns the transaction from that point forward.

**Approver list mutability after creation**
- Should the manually assigned approver list be editable after a transaction is created?
- If yes, should it lock after the first approver takes action (approve or reject)?
- Should there be any post-creation editability at all, or is it locked on create?

**Creator removal of automatically assigned approvers**
- Creators cannot remove automatically assigned approver groups. The entire value of entity-based assignment is that an admin configures protection that holds regardless of who creates the transaction. Creator-level removal defeats this.
- Open: should org admins be able to remove an automatic group from a specific transaction as an escape hatch for edge cases, or should overrides always go through the entity mapping (admin updates the entity-group assignment, not the transaction)?

**"Add Approver" modal design**
- Should the modal allow selecting individual contacts (by key), pre-created approver groups, or both?
- Should the modal allow creating a new group on the fly, or only selecting existing ones?
- Current leaning: show pre-created groups prominently (encouraged) and individual contacts secondarily. No on-the-fly group creation in this modal.

**Threshold for additional approvers** *(resolved)*
- Additional approvers use a threshold via `transaction_approver_list`. The creator picks contacts and sets a threshold (e.g., 2-of-5 must approve). This mirrors the same threshold concept used by predefined `approver_group`.

**Manual vs. automatic approvers: separation and storage** *(resolved)*
- Both automatic (snapshotted from matched groups) and additional approvers use `transaction_approver_list` + `transaction_approver_list_member`. Auto-matched lists have `name` and `description` snapshotted from the group; additional approver lists leave those null. Assignment rows are written atomically at creation time. Activity columns (`user_key_id`, `signature`, `approved`, `actioned_at`) are filled in when each user acts.
- The existing `TransactionApprover` entity is fully retired.
- In the UI, auto-matched groups and the manual list are displayed as separate labeled sections.

**Coexistence of manual and automatic approvers** *(resolved)*
- Both are independently required. All automatic group thresholds must be met and the manual list threshold must be met before the transaction advances. The two are not mutually exclusive.

**Post-approval visibility for approvers** *(resolved)*
- Once a transaction advances out of `READY_FOR_REVIEW`, the approval phase is closed and no further approve or reject submissions are accepted. Approvers can still view the transaction in a read-only state (e.g., in an "In Progress" or "Collecting Signatures" view). The Approve and Reject buttons are removed. A note is shown directing approvers to contact the admin or transaction creator if they have concerns — there is no in-app mechanism to reverse an approval after the phase closes.

**Group change gaming**
- The snapshot design prevents a changed group from affecting in-flight transactions. However, it does not prevent an admin from temporarily weakening a group (e.g., lowering threshold or swapping members), creating a transaction to capture that weakened snapshot, then restoring the group — making the group's history appear clean.
- The defense is an audit log on `approver_group` and `approver_group_member` changes. If a group was modified in the same time window that a transaction was created and snapshotted, the audit log makes that detectable. Without such a log, the attack is silent.
- Open: should the system emit immutable audit events for all group mutations, and should the transaction record reference the group's state at snapshot time in a way that makes retroactive tampering detectable?

**Cryptographic integrity of approval records**
- The `transaction_approver_list_member` row stores a `signature` over the transaction bytes and the public key used to produce it. These are verifiable — but any defense that relies solely on data within the database fails against an attacker with direct database write access. They can modify the signature, the public key bytes, or any other field to construct an apparently valid record.
- No in-database mechanism can fully defend against this. The trust boundary has to be drawn at the database layer: protect database access itself (network isolation, access controls, audit logging at the infrastructure level).
- The proper mitigation for cryptographic non-repudiation is an external, immutable record. Writing an HCS message at approval time — containing the approver's user ID, the transaction ID, the public key bytes, the signature, and a timestamp — creates a record that cannot be retroactively altered even by someone with full database access. Cross-checking DB approval records against the HCS topic exposes any tampering as a mismatch.
- This is related to the HCS sub-issue already in scope for this initiative. Open: determine whether approval events should be written to the same HCS topic as upgrade approvals, or to a separate topic, and define when cross-checking runs.
