# Approver Workflow Initiative — Session Handoff

This directory contains three draft sub-issues for the approver workflow initiative. They are works in progress, not yet filed on GitHub. This README provides the context needed to continue working on them across sessions.

## Parent Initiative

The three sub-issues stem from a single parent feature request with four stated problems to solve:

1. **No pre-approval mechanism** — transaction creators must manually assign approvers per transaction. There is no way to predefine that a specific Hedera entity always requires the same approvers, and no way to enforce a mandatory approval step before signers see the transaction.
2. **Premature transaction visibility** — signers can see and sign a transaction before designated approvers have reviewed it.
3. **Ambiguous transaction status** — the UI does not clearly distinguish between "pending approval" and "ready for signatures."
4. **No governed upgrade process** — there is no mechanism for an org to formally approve a frontend or backend version upgrade before it is applied.

## Existing Codebase State

Understanding what already exists is important context for the sub-issues:

- **`TransactionApprover` entity** — a self-referential tree (leaf = user, internal node = threshold list) is already fully implemented on the back-end. The tree structure is what the new flat `ApproverGroup` model replaces for the predefined group use case.
- **`FEATURE_APPROVERS_ENABLED = false`** — the entire approver feature is built but hidden behind this flag in `front-end/src/shared/constants/featureFlags.ts`. Turning it on exposes existing UI components and the "Ready for Review" tab.
- **"Ready for Review" tab** — already exists in the transaction list, gated by the same flag.
- **"Awaiting Approval" stepper stage** — already in `TransactionDetailsStatusStepper.vue`, gated by the flag.
- **No user-group concept** — there is no existing "team," "role," or "user group" abstraction anywhere in the back-end. Every approver/observer/signer relationship is per-transaction, per-user. The new `ApproverGroup` tables introduce this concept for the first time.
- **Contacts** — the front-end has a flat org-user directory (`Contact` Prisma model) used for display names. No server-side equivalent.
- **`version-check` endpoint** — `POST /users/version-check` already exists and is called regularly by the frontend. The HCS upgrade approval check hooks into this cadence.

## The Three Sub-Issues and How They Relate

### 1. `approver-group-data-model.md` — Schema only
Introduces four new back-end database tables: `approver_group`, `approver_group_member`, `entity_approver_group`, and `transaction_entity`. No behavior changes. This is a prerequisite for the workflow issue.

### 2. `approver-group-workflow.md` — Transaction approval behavior
Builds on the schema to implement: admin UI for creating groups and assigning them to entities, automatic approver group resolution at transaction creation time, and conditional signer visibility gated on approval completion. This is about approving **individual transactions**, not app upgrades.

### 3. `hcs-upgrade-approval.md` — App upgrade governance
Entirely separate concern from issues 1 and 2. Uses a Hedera Consensus Service (HCS) topic to create a trustless, on-chain record of which app versions an org has approved. The frontend reads this directly from the mirror node — the backend is not in the verification path. This issue stands alone and can be implemented independently of 1 and 2.

## Closed Design Decisions

These were deliberated and closed. Do not re-open without a strong reason.

**Approver group structure: flat list with threshold, not nested tree.**
The existing `TransactionApprover` supports arbitrary nested threshold trees. For predefined groups, this is unnecessary complexity. A flat member list plus a threshold covers all realistic use cases. Multi-group behavior (requiring approval from several independent groups) is achieved by assigning multiple groups to an entity, not by nesting groups within groups.

**Many-to-many between entities and groups.**
One group can be assigned to multiple entities. One entity can have multiple groups assigned. This avoids duplicating group definitions and is implemented via the `entity_approver_group` join table.

**Live link, not snapshot.**
Group membership is not copied into the transaction at creation time. Approval requirements are resolved at query time by walking `Transaction → TransactionEntity → EntityApproverGroup → ApproverGroup → ApproverGroupMember`. Updating a group immediately affects all pending transactions referencing it. A member removed after already approving retains their approval; a member added mid-transaction becomes a required approver going forward.

**HCS topic over Hedera File for upgrade approval.**
A Hedera File was the first candidate. Rejected because: (a) reading file contents requires a paid `FileContentsQuery` — the mirror node does not expose file contents for free, and (b) there is no free way to verify what was written to the file via mirror node. HCS topics are free to read from mirror node and the network-enforced `submitKey` provides trustless access control without any backend involvement.

**Topic ID must be entered manually by the user.**
Auto-detecting the topic ID from the transaction history was considered and rejected for two reasons: not all org members are participants in the topic creation transaction so they would never see it, and an org may create multiple HCS topics for unrelated purposes making auto-detection ambiguous and spoofable.

**`adminKey` = fee payer account key (by convention, not protocol).**
Hedera does not support a live reference from a topic's `adminKey` to an account. The `adminKey` is static key material. Setting it to match the fee payer account's key at topic creation time achieves the same practical effect, with the caveat that key rotation on the fee payer account requires a separate `TopicUpdateTransaction` to keep them in sync.

**Hard disconnect on version mismatch, no downgrade support.**
If an installed frontend version exceeds an org's approved version, the frontend hard-disconnects from that org. Downgrade via `electron-updater` is not supported — users requiring a downgrade need IT assistance. A read-only mode was considered but deferred as too much scope for the first pass.

**Backend self-check as safety net only.**
The backend can check the HCS topic on startup and refuse to start if its version is not approved. This is a guard against accidental deployments, not a security control — a compromised deployment can always bypass it. The frontend's direct mirror node query is the trust root.
