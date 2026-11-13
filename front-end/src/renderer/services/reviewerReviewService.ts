import type { ITransactionFull } from '@shared/interfaces';
import {
  verifyReviewSignature,
  type ReviewVerificationStatus,
} from '@shared/utils/reviewerReviewVerification';

import { hexToUint8Array } from '@renderer/utils';
import { computeTransactionHash } from '@renderer/utils/sdk';

/* Reviewer Review Service: verifies transaction review signatures against the public key served
 * with each review record (see #3194). The organization server is trusted for that key. */

export interface IReviewMemberVerification {
  userId: number;
  // null: not yet reviewed (no signature to check).
  status: ReviewVerificationStatus | null;
}

export interface IReviewListVerification {
  listId: number;
  members: IReviewMemberVerification[];
}

// Returns null if the transaction's hash can't be independently computed (missing or unfrozen
// `unsignedTransactionBytes`, e.g. a transaction created by an older client) - nothing can be
// verified without it, and the caller should treat that the same as "unverifiable".
export const verifyTransactionReviews = async (
  transaction: ITransactionFull,
): Promise<IReviewListVerification[] | null> => {
  if (!transaction.unsignedTransactionBytes) return null;

  const transactionHash = await computeTransactionHash(
    hexToUint8Array(transaction.unsignedTransactionBytes),
  );
  if (!transactionHash) return null;

  return (transaction.reviewerLists ?? []).map(list => ({
    listId: list.id,
    members: list.members.map(member => ({
      userId: member.userId,
      status: verifyReviewSignature(transaction.id, transactionHash, member),
    })),
  }));
};
