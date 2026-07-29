# Reviewer Group Management and Transaction Review Workflow

## Summary

Implement the admin UI and API for creating and managing reviewer groups, the automatic assignment of reviewer groups to new transactions based on affected entities, client-side verification of review records against locally stored group state, and conditional transaction visibility for signers based on review status.

## Background

With the schema in place (see `approver-group-data-model.md`), this sub-issue covers how reviewer groups are created and managed by admins, how they are automatically pulled into new transactions at creation time, how review status affects signer visibility, and how the frontend verifies review integrity using locally stored group and public key data — without trusting the backend as the source of truth for group state.

## Who Can Manage Reviewer Groups

Org admins only can create, edit, and delete reviewer groups and entity assignments. All org members can view group names, membership, and threshold — transparency is intentional so anyone can understand why a transaction requires review and from whom.

## Creating and Managing Reviewer Groups

Admins create reviewer groups through a dedicated section of the org settings UI. The org settings UI is slated for a broader overhaul; the reviewer group management screens should be scoped to that effort rather than bolted onto the current layout. For each group, the admin specifies a name, optional description, threshold, and member list drawn from the org's user directory. Groups can be assigned to any number of Hedera entities — accounts, files, nodes, topics. One entity can have multiple groups. One group can cover multiple entities.

## Group Change Attestation

Because the frontend stores reviewer groups locally and verifies review records against locally-known public keys, changes to a group must be verifiably authorized before the client accepts them. When a group changes — membership added or removed, threshold updated, name or description changed — the backend must supply:

1. The new group snapshot (name, description, threshold, full member list with public keys)
2. An attestation: a signature over the new snapshot, produced by a threshold of the **current** group's members (using the same threshold the group has for reviews)

The client verifies the attestation against its locally-stored public keys for the current group. If verification passes, the client replaces its local snapshot with the new one. If verification fails, the client rejects the update and alerts the user.

**Attestation chain:** If a client was offline while multiple sequential group changes occurred, the backend must supply the full ordered chain of intermediate snapshots and attestations — not just the latest state. The client verifies each hop in sequence: snapshot N's keys verify the attestation for snapshot N+1, then snapshot N+1's keys verify the attestation for snapshot N+2, and so on. A client cannot skip from an old snapshot to a newer one without walking the full chain.

**New groups and first-time users (Trust On First Use):** When a client encounters a group it has no local record of — either a newly created group or because the user is connecting for the first time — it must accept the backend-provided snapshot without cryptographic verification, since there is no prior local baseline to check against. This is the fundamental trust boundary: after initial trust is established, all subsequent changes require verifiable attestation. New users should verify their initial group state out-of-band with their org admin.

## Transaction Creation UX — Live Group Preview

During transaction creation, as the creator fills in entities (fee payer, sender/receiver accounts, file IDs, etc.), the frontend queries the API to check whether any of those entities have associated reviewer groups. Matched groups are displayed immediately in the reviewers section as a read-only preview, so the creator knows before submitting that a review requirement will be applied. The creator cannot remove these automatically matched groups from the form.

The creator may also add additional reviewers on top of the automatically matched ones. The "Add Reviewer" modal lets the creator select individual contacts and optionally set a threshold (e.g., 2-of-5 selected contacts must accept). The selected contacts and threshold are stored as a `transaction_reviewer_list` row. Both automatic groups and the ad-hoc list are independently required — all automatic group thresholds must be met and the ad-hoc list threshold must be met before the transaction advances to fully reviewed.

**Creator exclusion:** The transaction creator is excluded from acting as a reviewer, even if they are a member of a matched reviewer group. At snapshot time, any `transaction_reviewer_list_member` row that would be created for the creator is omitted. Their presence in the group does not inflate the member count against which the threshold is evaluated.

## Automatic Reviewer Assignment on Transaction Creation

When a new transaction is created, the API:

1. Decodes the `transactionBytes` using the Hedera SDK to extract all affected entities
2. Persists those entities to `transaction_entity`
3. Queries `entity_reviewer_group` for any groups mapped to those entities
4. For each matched group, creates a `transaction_reviewer_list` row (copying the group's current `name`, `description`, and `threshold`) and a `transaction_reviewer_list_member` row for each current group member, excluding the transaction creator
5. If the creator added additional reviewers, creates one additional `transaction_reviewer_list` row (null `name` and `description`) with the selected contacts and threshold as `transaction_reviewer_list_member` rows
6. All of the above are written atomically in the same database transaction as the `transaction` row itself

If any lists were created, the transaction's initial status is set to `READY_FOR_REVIEW`. The assigned reviewers are notified. Signers are notified as normal — review does not block signer notification.

If no entity-group mappings matched and no additional reviewers were added, the transaction proceeds with its normal initial status with no review phase.

All `transaction_reviewer_list` and `transaction_reviewer_list_member` rows are permanent — they are never deleted, even after the transaction reaches a terminal state. They form the complete audit record of who was assigned to review, at what threshold, and what action (if any) each assignee took.

## Transaction Visibility for Signers

Transactions pending review are hidden from signers by default, but signers can opt in to see them via a filter or secondary tab ("Show unreviewed transactions" or similar). This is the only gate — signers are never hard-blocked from a transaction.

| Review state | Default signer visibility |
|---|---|
| No review required | Normal — shown in main list |
| Pending review, no rejections | Hidden by default; visible via filter |
| Pending review, one or more rejections | Hidden by default; visible via filter with prominent warning |
| Fully reviewed (all thresholds met, no rejections) | Normal — shown in main list |
| Fully reviewed with prior rejections (all resolved) | Normal — shown in main list |

When a signer views a transaction that has an unmet review or an outstanding rejection, the UI must make this prominently visible — a warning banner, status badge, or similar — so the signer understands they are signing at their own risk. No special flag is written to the signature record at this time; timestamps are recorded and this can be added later if needed.

## Review Tracking

Reviewing a transaction is a cryptographic attestation. The reviewer clicks Accept or Reject — the system automatically selects their first valid (non-deleted, active) org key, signs the transaction bytes with it, and submits the result. Key selection is never exposed to the reviewer. If the user is not using the system keychain, they are prompted for their password to decrypt the key; otherwise the signature is produced silently. If the user has no valid org key, the Accept and Reject buttons are disabled with an explanatory message — no key picker is shown.

When the action is submitted, `user_key_id`, `signature`, `accepted`, `note`, and `actioned_at` are written onto the reviewer's `transaction_reviewer_list_member` row(s). If the reviewer appears in more than one list on the transaction (e.g., they were a member of two auto-matched groups), all their pending rows across all lists are updated in the same operation — one action satisfies all lists simultaneously. The `user_key_id` and `signature` are stored for cryptographic audit only and are not surfaced in the UI.

**Rejection:** A rejection (`accepted = false`) does not end or block the transaction. The reviewer may optionally provide a note explaining their concern. The note is visible to all parties — signers, other reviewers, the creator, and observers. The transaction creator is notified immediately when a rejection is recorded. The transaction remains in the review phase; other reviewers may still accept. Rejection does not count toward the threshold — only `accepted = true` rows count.

**Threshold evaluation:** For each `transaction_reviewer_list` on the transaction, the system counts member rows where `accepted = true`. If that count meets or exceeds the list's `threshold`, the list is satisfied. Rejected rows do not count. All lists must be satisfied for the transaction to advance to fully reviewed. Evaluation is user-based — `user_id`, not `user_key_id`.

When all lists are satisfied, the transaction's status advances to `READY_TO_SIGN` and it becomes visible to signers in the normal flow. This status transition happens synchronously within the same API call that recorded the final acceptance. Once the transaction advances out of `READY_FOR_REVIEW`, no further review submissions are accepted — the review phase is closed. Reviewers can still view the transaction in a read-only state; a note is shown directing them to contact the admin or creator if they have concerns.

## Frontend Verification of Review Records

The frontend does not trust the backend's representation of who reviewed a transaction. When displaying review status, the frontend:

1. Fetches `transaction_reviewer_list` and `transaction_reviewer_list_member` records from the backend
2. For each member row with a non-null `signature`, retrieves the reviewer's public key from the **local client store** (not from the backend)
3. Verifies the signature against the transaction bytes using that locally-stored key
4. Displays only verified records as accepted or rejected; unverified records are flagged as suspicious

This means a backend that fabricates a review record — writing a fake `accepted = true` row — cannot make the frontend count it toward the threshold, because the frontend will fail to verify the signature against the locally-stored key.

## Group Changes After Transaction Creation

Because review requirements are snapshotted at creation time, changes to a `reviewer_group` after a transaction is created have no effect on that transaction. The transaction's `transaction_reviewer_list` rows are immutable. Modifying or soft-deleting the predefined group only affects future transactions.

## Feature Flag

This feature ships behind the existing `FEATURE_APPROVERS_ENABLED` flag and is enabled once the full workflow is validated end-to-end.

## Future Considerations

These capabilities are intentionally out of scope for the initial implementation but must be accounted for in the data model design so they can be added later without a breaking schema change.

**Transaction-type-based reviewer group assignment.** Currently, groups are assigned to Hedera entities. A future extension would allow groups to be assigned to transaction types directly — for example, "any `NodeCreateTransaction` requires the Node Governance group, regardless of which entities are involved." This would require a separate matching table (e.g., `transaction_type_reviewer_group`) alongside the existing `entity_reviewer_group`, evaluated at the same creation-time step.

**Conditional rules.** A further extension would allow reviewer group assignment to be conditional on transaction properties — for example, "a transfer over 100 HBAR requires the Treasury Board group, but a transfer under 100 HBAR does not."

**Combined matching.** Rules could combine entity, type, and condition. The resolution order and precedence between overlapping rules will need to be defined when this is implemented.

**Pre-review signing flag.** If a signer opts in to view and sign a transaction before review is complete, recording that fact on the signature row would allow future audits to distinguish signatures collected before vs. after full review. Not implemented in the initial pass; timestamps are sufficient for now.

The current schema does not preclude any of these.

## Open Questions

**Reviewer list mutability after creation**
- Should the additionally added reviewer list be editable after a transaction is created?
- If yes, should it lock after the first reviewer takes action?
- Or is it locked on create?

**Creator removal of automatically assigned reviewers**
- Creators cannot remove automatically assigned reviewer groups.
- Open: should org admins be able to remove an automatic group from a specific transaction as an escape hatch, or should overrides always go through the entity mapping?

**"Add Reviewer" modal design** *(resolved direction)*
- Show pre-created groups prominently and individual contacts secondarily. No on-the-fly group creation in this modal.

**Reviewer changing their decision**
- Can a reviewer change a rejection to an acceptance (or vice versa) after submitting?
- If yes, should there be a time limit or a condition (e.g., only before threshold is met)?
- Open.

**Rules attestation**
- Group membership changes require attestation signed by the current group. Rules — the `entity_reviewer_group` mappings — are currently admin-managed with no equivalent attestation requirement.
- The concern is not an admin adding a rule and leaving it: the snapshot captures the rule at transaction creation time. The concern is an admin *removing* a rule, creating a transaction without that review requirement, then re-adding the rule — making the group's rule history appear clean while bypassing a review that should have applied.
- Whether rules require their own attestation mechanism (and who would attest — the mapped group? a separate admin quorum?) is unresolved. This is harder than group attestation because rules are many-to-many across entities and groups.

**Cryptographic integrity and database trust**
- `transaction_reviewer_list_member` stores a `signature` verifiable against the reviewer's public key. Frontend verification against locally-stored keys (not backend-served keys) closes the fabricated-review attack vector.
- However, any defense that relies solely on data within the database fails against an attacker with direct database write access. The local client store shifts the trust anchor out of the backend database, but the local store itself could be tampered with on a compromised client machine.
- **Suggested security model (defense in depth):**
  - *Separate read from write.* Grant humans a `readonly` database role; only the application user gets INSERT/UPDATE on sensitive tables.
  - *Immutability triggers.* Use database-level `BEFORE UPDATE` triggers:
    - On `user_key`: once `public_key_bytes` is set, it cannot be updated. A key is never changed — it is soft-deleted and replaced. Prevents swapping a user's public key to one the attacker controls.
    - On `transaction_reviewer_list_member`: once `accepted` and `actioned_at` are set, those columns cannot be changed.
    - A PostgreSQL superuser can disable a trigger (`ALTER TABLE ... DISABLE TRIGGER`), make the change, then re-enable it — but this DDL statement appears in the `pgaudit` log, making it a detectable anomaly.
  - *External audit log.* Enable `pgaudit` and ship all DML logs to an external aggregator (CloudWatch, Splunk, etc.) that database administrators cannot modify. Tampering becomes detectable and attributable even if it cannot be prevented.
  - *Separate credential management.* Store the application's database credentials in a secrets manager with access controls independent of the database itself. Compromising both requires breaching two separate systems.
  - *Residual risk.* Someone with both superuser database access and credential store access can still impersonate the application. The defense is operational: minimize who holds both, require multi-party approval for superuser credential use, and treat any superuser session as a security event.

**Group change gaming**
- The snapshot design prevents a changed group from affecting in-flight transactions. However, an admin could temporarily weaken a group, create a transaction to capture that weakened snapshot, then restore the group.
- The group change attestation requirement (a threshold of current members must sign off on any change) significantly raises the bar: weakening a group now requires colluding with enough current members to meet threshold. A single admin cannot do it unilaterally.
- Remaining gap: a sufficiently colluding threshold of members could still do this. The attestation chain stored by the backend provides a record of every change and who signed it — whether to surface this in the UI or as an audit report is open.
