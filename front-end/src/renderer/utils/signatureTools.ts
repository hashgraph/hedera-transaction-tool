import { AccountId, PublicKey, SignatureMap, TransactionId } from '@hashgraph/sdk';
import { hexToUint8Array } from '@renderer/utils/index.ts';
import type { V1ImportCandidate } from '@shared/interfaces';


export const makeSignatureMap = (candidates: V1ImportCandidate[]): SignatureMap => {
  const result: SignatureMap = new SignatureMap();

  if (candidates.length > 0) {
    // Note: all candidates have the same transactionId
    const transactionId = TransactionId.fromString(candidates[0].transactionId);

    for (const candidate of candidates) {
      for (const nodeAccountId of Object.keys(candidate.nodeSignatures)) {
        const nodeAccountIdObj = AccountId.fromString(nodeAccountId);
        for (const publicKey of Object.keys(candidate.nodeSignatures[nodeAccountId])) {
          const signature = candidate.nodeSignatures[nodeAccountId][publicKey];
          result.addSignature(
            nodeAccountIdObj,
            transactionId,
            PublicKey.fromString(publicKey),
            hexToUint8Array(signature)
          )
        }
      }
    }
  }

  return result
}
