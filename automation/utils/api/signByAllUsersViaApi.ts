import type { UserDetails } from '../../pages/OrganizationPage.js';
import { signTransactionForBackend } from './offlineSign.js';
import {
  getOrganizationTransactionByHederaId,
  loginToOrganizationApi,
  uploadOrganizationSignatures,
  type OrganizationTransaction,
} from './organizationApi.js';

export interface SignByAllUsersResult {
  signedUsers: number;
  transactionDbId: number;
  totalAcceptedSigners: number;
}

export async function signTransactionByAllUsersViaApi(
  users: UserDetails[],
  hederaTxId: string,
): Promise<SignByAllUsersResult> {
  if (users.length < 2) {
    throw new Error(
      `signTransactionByAllUsersViaApi requires at least 2 users (creator + signers); got ${users.length}`,
    );
  }
  if (!hederaTxId) {
    throw new Error('signTransactionByAllUsersViaApi: hederaTxId is empty');
  }

  const creator = users[0];
  const creatorToken = await loginToOrganizationApi(creator.email, creator.password);
  const tx: OrganizationTransaction = await getOrganizationTransactionByHederaId(
    creatorToken,
    hederaTxId,
  );

  const signers = users.slice(1);
  let totalAcceptedSigners = 0;
  // Signers must run sequentially: each upload triggers a read-modify-write on the
  // server-side `transactionBytes` (sdkTransaction.addSignature → UPDATE). Concurrent
  // uploads race and lose signatures in the persisted bytes — even though the
  // TransactionSigner rows for both still get inserted.
  for (const user of signers) {
    const token = await loginToOrganizationApi(user.email, user.password);
    const signatureMap = signTransactionForBackend(tx.transactionBytes, user.privateKey);
    const response = await uploadOrganizationSignatures(token, [{ id: tx.id, signatureMap }]);
    const accepted = response.signers?.length ?? 0;
    totalAcceptedSigners += accepted;
    console.log(
      `[signTransactionByAllUsersViaApi] tx db-id=${tx.id} ${user.email} → backend accepted ${accepted} signer(s). Response: ${JSON.stringify(response)}`,
    );
  }

  if (totalAcceptedSigners === 0) {
    throw new Error(
      `signTransactionByAllUsersViaApi: backend accepted 0 signatures across ${signers.length} signer(s) for tx db-id=${tx.id}; check server-side validation logs (likely PNY/ISNMP/TNRS).`,
    );
  }

  return { signedUsers: signers.length, transactionDbId: tx.id, totalAcceptedSigners };
}
