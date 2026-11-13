// Review-record verification (issue #3194 "Review Record Verification"): verifies a
// reviewer's own signature on a transaction review against LOCALLY-held reviewer keys, never
// keys served by the organization. This is independent of reviewer group/rule sync
// (shared/utils/reviewerSync.ts), which trusts the organization server outright — a
// reviewer's signature on their own review is the one thing in this feature the client still
// verifies itself.
//
// A `TransactionReviewerList` is a snapshot taken when the transaction was created and is
// never linked back to a group afterward (no groupId is stored), so a reviewer's key is
// looked up by `userKeyId` across every group currently held locally, not through that
// group's own history. A departed member's key will no longer be found there, which is
// "unverifiable", not "invalid" — the signature was never checked, so it can't be said to be
// wrong.
//
// The message format is fixed by the back-end (reviewers.service.ts buildReviewAttestationMessage)
// and is never a signature over the transaction's bytes/bodyBytes.

import { PublicKey } from '@hashgraph/sdk';

import type { IStoredReviewerGroup, ITransactionReviewerListMember } from '../interfaces';

export const buildReviewAttestationMessage = (
  transactionId: number,
  accepted: boolean,
  note: string | null,
  transactionHash: string,
): Uint8Array =>
  new TextEncoder().encode(
    `${transactionId}:${accepted ? 'ACCEPT' : 'REJECT'}:${note ?? ''}:${transactionHash}`,
  );

// Every current member's key, across every locally-held group, keyed by userKeyId.
export const indexCurrentReviewerKeys = (
  groups: Pick<IStoredReviewerGroup, 'members'>[],
): Map<number, string> => {
  const keys = new Map<number, string>();
  for (const group of groups) {
    for (const member of group.members) {
      keys.set(member.userKeyId, member.publicKey);
    }
  }
  return keys;
};

export type ReviewVerificationStatus = 'verified' | 'invalid' | 'unverifiable';

// null means "not yet reviewed" (no signature to check), distinct from the unverifiable/invalid
// statuses that apply once a signature exists.
export const verifyReviewSignature = (
  transactionId: number,
  transactionHash: string,
  member: Pick<ITransactionReviewerListMember, 'accepted' | 'note' | 'userKeyId' | 'signature'>,
  currentKeysByUserKeyId: ReadonlyMap<number, string>,
): ReviewVerificationStatus | null => {
  // accepted is always set alongside signature by the back-end; both are checked only so the
  // message below can be built with a non-null `accepted`.
  if (member.signature === null || member.accepted === null) return null;

  const publicKey =
    member.userKeyId !== null ? currentKeysByUserKeyId.get(member.userKeyId) : undefined;
  if (!publicKey) return 'unverifiable';

  const message = buildReviewAttestationMessage(
    transactionId,
    member.accepted,
    member.note,
    transactionHash,
  );
  try {
    const key = PublicKey.fromString(publicKey);
    const signature = Buffer.from(member.signature, 'hex');
    return key.verify(message, signature) ? 'verified' : 'invalid';
  } catch {
    return 'invalid';
  }
};
