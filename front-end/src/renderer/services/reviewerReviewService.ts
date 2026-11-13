import type { ITransactionFull } from '@shared/interfaces';
import {
  indexCurrentReviewerKeys,
  verifyReviewSignature,
  type ReviewVerificationStatus,
} from '@shared/utils/reviewerReviewVerification';

import { hexToUint8Array } from '@renderer/utils';
import { computeTransactionHash } from '@renderer/utils/sdk';
import { getReviewerState } from '@renderer/services/reviewerStoreService';

/* Reviewer Review Service: verifies transaction review signatures against the LOCALLY-held
 * reviewer keys, never keys served by the organization (see #3194 "Review Record Verification"). */

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
  organizationId: string,
): Promise<IReviewListVerification[] | null> => {
  if (!transaction.unsignedTransactionBytes) return null;

  const transactionHash = await computeTransactionHash(
    hexToUint8Array(transaction.unsignedTransactionBytes),
  );
  if (!transactionHash) return null;

  const { groups } = await getReviewerState(organizationId);
  const currentKeys = indexCurrentReviewerKeys(groups);

  return (transaction.reviewerLists ?? []).map(list => ({
    listId: list.id,
    members: list.members.map(member => ({
      userId: member.userId,
      status: verifyReviewSignature(transaction.id, transactionHash, member, currentKeys),
    })),
  }));
};
