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
  if (users.length < 1) {
    throw new Error(
      `signTransactionByAllUsersViaApi requires at least 1 user; got ${users.length}`,
    );
  }
  if (!hederaTxId) {
    throw new Error('signTransactionByAllUsersViaApi: hederaTxId is empty');
  }

  const fetcherToken = await loginToOrganizationApi(users[0].email, users[0].password);
  const tx: OrganizationTransaction = await getOrganizationTransactionByHederaId(
    fetcherToken,
    hederaTxId,
  );

  let totalAcceptedSigners = 0;
  // All users sign sequentially: each upload triggers a read-modify-write on the
  // server-side `transactionBytes` (sdkTransaction.addSignature → UPDATE). Concurrent
  // uploads — including a UI-creator-sign racing with the first API upload — lose
  // signatures in the persisted bytes even though TransactionSigner rows still get
  // inserted. Signing the creator through this helper avoids that race entirely.
  for (const user of users) {
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
      `signTransactionByAllUsersViaApi: backend accepted 0 signatures across ${users.length} signer(s) for tx db-id=${tx.id}; check server-side validation logs (likely PNY/ISNMP/TNRS).`,
    );
  }

  return { signedUsers: users.length, transactionDbId: tx.id, totalAcceptedSigners };
}
