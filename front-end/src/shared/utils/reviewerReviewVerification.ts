// Review-record verification (issue #3194): verifies a reviewer's own signature on a
// transaction review against the public key the organization serves with the review record
// (`userKey`, the same way transaction signers carry theirs). The organization server is
// trusted for that key, so this catches corrupted or mismatched records, not a malicious
// server. A member whose key is no longer available is "unverifiable", not "invalid" — the
// signature was never checked, so it can't be said to be wrong.
//
// The message format is fixed by the back-end (reviewers.service.ts buildReviewAttestationMessage)
// and is never a signature over the transaction's bytes/bodyBytes.

import { PublicKey } from '@hiero-ledger/sdk';

import type { ITransactionReviewerListMember } from '../interfaces';

export const buildReviewAttestationMessage = (
  transactionId: number,
  accepted: boolean,
  note: string | null,
  transactionHash: string,
): Uint8Array =>
  new TextEncoder().encode(
    `${transactionId}:${accepted ? 'ACCEPT' : 'REJECT'}:${note ?? ''}:${transactionHash}`,
  );

export type ReviewVerificationStatus = 'verified' | 'invalid' | 'unverifiable';

// null means "not yet reviewed" (no signature to check), distinct from the unverifiable/invalid
// statuses that apply once a signature exists.
export const verifyReviewSignature = (
  transactionId: number,
  transactionHash: string,
  member: Pick<ITransactionReviewerListMember, 'accepted' | 'note' | 'userKey' | 'signature'>,
): ReviewVerificationStatus | null => {
  // accepted is always set alongside signature by the back-end; both are checked only so the
  // message below can be built with a non-null `accepted`.
  if (member.signature === null || member.accepted === null) return null;

  const publicKey = member.userKey?.publicKey;
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
