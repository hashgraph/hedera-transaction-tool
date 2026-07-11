# On-Chain Upgrade Approval via Hedera Consensus Service (HCS)

## Summary

Implement a trustless, on-chain mechanism for orgs to approve frontend and backend version upgrades using an HCS topic, with the frontend verifying approval directly against the mirror node without relying on the backend as a source of truth.

## Background

An early candidate was a Hedera File whose contents would store the approved version string. This was rejected for two reasons: reading file contents requires a paid `FileContentsQuery`, and the mirror node does not expose file contents — there is no free verification path. HCS topics solve both problems. Submitting a message is a one-time cost at approval time (fraction of a cent), and the mirror node stores all topic messages and makes them freely queryable via REST. Critically, the topic's `submitKey` means the Hedera network itself enforces who is authorized to post approval messages — the frontend needs no signature verification of its own.

## Topic Design

Each org that opts into upgrade approval creates one dedicated HCS topic through the Transaction Tool frontend. The topic is configured with:

- **`adminKey`**: Set to the same key material as the org's fee payer account. Whoever controls the fee payer account controls the topic's administrative rights — no new key management required. This is a snapshot of the fee payer key at topic creation time, not a live reference. If the fee payer account rotates its key, the topic's `adminKey` must be updated separately via `TopicUpdateTransaction`.
- **`submitKey`**: A threshold key agreed upon by the org (e.g., 2-of-5 keys from a designated approver group). Only signers satisfying this threshold can post messages. The Hedera network enforces this.

Topic creation is done through the Transaction Tool frontend by an org admin. After execution, the resulting topic ID is displayed prominently in the transaction details so the admin can record and distribute it.

## Why Manual Topic ID Entry

Rather than auto-detecting the topic ID, users must enter it manually after receiving it from their org admin. Two reasons:

1. Not all org members participate in the topic creation transaction. Users who were not signers or observers would never see it in their list. Polling the mirror node for all `TopicCreateTransaction`s by the fee payer account is expensive and would surface unrelated topics.
2. An org may create multiple HCS topics for different purposes. There is no reliable way to distinguish the version approval topic from any other without explicit user input. A memo convention is fragile and spoofable.

Manual entry is explicit, verifiable, and secure.

## Pin-on-First-Use

When a user connects to an org whose backend reports a topic ID not yet pinned locally, the frontend displays the topic ID prominently and prompts the user to verify it with their org admin out-of-band. On confirmation, it is pinned to the local `Organization` record. Once pinned, the backend cannot silently change it. If the backend-reported topic ID ever diverges from the locally-pinned value on a subsequent connection, the frontend hard-disconnects and instructs the user to contact their admin.

## Approving a Version

A member of the org's submitKey threshold group creates a `TopicMessageSubmitTransaction` through the Transaction Tool, with the approved version string as the message content (e.g., `0.35.0`). This goes through the normal Transaction Tool approval workflow, requiring threshold signatures matching the topic's `submitKey`. Once executed, the message is timestamped by the network and readable for free via mirror node.

## Frontend Verification

When the backend announces a new version is available, the frontend queries the mirror node directly — the backend is not in the verification data path:

```
GET /api/v1/topics/{topicId}/messages?order=desc&limit=1
```

The frontend reads the message content and compares it against the announced version. If they match, the upgrade prompt is shown. If not, the upgrade is blocked and the user is informed the version has not been approved by their org. This check is triggered by version availability announcements only — not on every API call.

## Version Lock Behavior

| Situation | Behavior |
|---|---|
| Installed version > approved version | Hard disconnect from that org, inform user |
| No topic ID configured | No version lock, upgrades unrestricted |
| Topic unreadable (mirror node error) | Warn but do not disconnect |
| Pre-upgrade check fails for any connected org | Warn user which orgs will lock them out, require explicit confirmation before proceeding |

No downgrade support. Users who need to downgrade require IT assistance.

## Key Rotation

If the approver group membership changes, the org admin submits a `TopicUpdateTransaction` (signed by the fee payer key) updating the `submitKey`. Topic ID is unchanged. No frontend action required from org members.
