import {
  AccountId,
  PrivateKey,
  PublicKey,
  Timestamp,
  Transaction,
  TransactionId,
} from '@hashgraph/sdk';
import { IKeyPairWithAccountId } from '../../main/shared/interfaces/IKeyPair';
import { decryptPrivateKey } from './keyPairService';

export const createTransactionId = (
  accountId: AccountId | string,
  validStart: Timestamp | string | Date | null,
) => {
  if (typeof accountId === 'string') {
    accountId = AccountId.fromString(accountId);
  }

  if (!validStart) {
    validStart = Timestamp.generate();
  }

  if (typeof validStart === 'string' || validStart instanceof Date) {
    validStart = Timestamp.fromDate(validStart);
  }

  return TransactionId.withValidStart(accountId, validStart);
};

export const getTransactionSignatures = async (
  keyPairs: IKeyPairWithAccountId[],
  transaction: Transaction,
  addToTransaction: boolean,
  userId: string,
  password: string,
) => {
  const signatures: { publicKey: PublicKey; signature: Uint8Array }[] = [];
  const publicKeys: string[] = [];

  await Promise.all(
    keyPairs.map(async keyPair => {
      const privateKeyString = await decryptPrivateKey(userId, password, keyPair.publicKey);

      const privateKey = PrivateKey.fromStringED25519(privateKeyString);
      const signature = privateKey.signTransaction(transaction);

      if (!publicKeys.includes(keyPair.publicKey)) {
        signatures.push({ publicKey: PublicKey.fromString(keyPair.publicKey), signature });
        publicKeys.push(keyPair.publicKey);
      }
    }),
  );

  addToTransaction && signatures.forEach(s => transaction.addSignature(s.publicKey, s.signature));

  return signatures;
};
