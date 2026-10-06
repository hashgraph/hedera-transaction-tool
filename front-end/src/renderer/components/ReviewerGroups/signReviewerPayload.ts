import type { KeyPair } from '@prisma/client';
import type { IUserKey } from '@shared/interfaces';

import { decryptPrivateKey } from '@renderer/services/keyPairService';
import { getPrivateKey } from '@renderer/utils/sdk';
import { uint8ToHex } from '@renderer/utils';
import { ActionStatus, type ActionReport } from '@renderer/components/ActionController/ActionReport';

// Reviewer group/rule actions are signed as the proposer's trust anchor using whichever of
// the user's own org keys is actually usable on this device — i.e. one whose private key is
// stored locally (same selection the transaction-creator signing flow uses, see
// TransactionGroupProcessor.vue's `user.keyPairs[0]`), not just any key the org knows about.
// `user.selectedOrganization.userKeys` lists every key the org has on record, including ones
// whose private key was never imported/restored on this machine.
export function resolveReviewerSigningKey(
  keyPairs: KeyPair[],
  organizationUserKeys: IUserKey[],
): { orgKeyId: number; orgKeyPublicKey: string } | ActionReport {
  const localKeyPair = keyPairs[0];
  const orgKey = localKeyPair
    ? organizationUserKeys.find(k => k.publicKey === localKeyPair.public_key)
    : undefined;

  if (!orgKey) {
    return {
      status: ActionStatus.Error,
      title: 'No signing key available',
      what: 'This action must be signed with one of your keys, but none are available on this device',
      why: 'No private key for this organization is stored locally',
      next: 'Go to Settings > Keys and restore or import one of your keys, then try again',
    };
  }

  return { orgKeyId: orgKey.id, orgKeyPublicKey: orgKey.publicKey };
}

// Group creation (snapshotVersion=1) and rule-add require no member attestation, but the
// back-end DTOs still require the proposer's own signature as the trust anchor for the
// change record. The back-end does not verify this signature yet (see reviewer-groups
// .service.ts/reviewer-rules.service.ts createGroup/createRule — userSignature is stored,
// not checked), so this canonical JSON form is a placeholder pending #3194 finalizing the
// verification format.
export async function signReviewerPayload(
  personalUserId: string,
  personalPassword: string | null,
  orgKeyId: number,
  orgKeyPublicKey: string,
  payload: unknown,
): Promise<{ userKeyId: number; userSignature: string }> {
  const privateKeyRaw = await decryptPrivateKey(personalUserId, personalPassword, orgKeyPublicKey);
  const privateKey = getPrivateKey(orgKeyPublicKey, privateKeyRaw);
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const userSignature = uint8ToHex(privateKey.sign(bytes));

  return { userKeyId: orgKeyId, userSignature };
}
