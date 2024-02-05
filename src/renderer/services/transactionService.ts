import {
  AccountId,
  PrivateKey,
  PublicKey,
  Timestamp,
  Transaction,
  TransactionId,
} from '@hashgraph/sdk';

import { KeyPair, Transaction as Tx } from '@prisma/client';

import { CustomNetworkSettings, Network } from '../stores/storeNetwork';

import { decryptPrivateKey } from './keyPairService';
import { getMessageFromIPCError } from '../utils';

/* Transaction service */

/* Crafts transaction id by account id and valid start */
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

/* Collects and adds the signatures for the provided key pairs */
export const getTransactionSignatures = async (
  keyPairs: KeyPair[],
  transaction: Transaction,
  addToTransaction: boolean,
  userId: string,
  password: string,
) => {
  const signatures: { publicKey: PublicKey; signature: Uint8Array }[] = [];
  const publicKeys: string[] = [];

  try {
    await Promise.all(
      keyPairs.map(async keyPair => {
        const privateKeyString = await decryptPrivateKey(userId, password, keyPair.public_key);
        const startsWithHex = privateKeyString.startsWith('0x');

        const keyType = PublicKey.fromString(keyPair.public_key);

        const privateKey =
          keyType._key._type === 'secp256k1'
            ? PrivateKey.fromStringECDSA(`${startsWithHex ? '' : '0x'}${privateKeyString}`)
            : PrivateKey.fromStringED25519(privateKeyString);
        const signature = privateKey.signTransaction(transaction);

        if (!publicKeys.includes(keyPair.public_key)) {
          signatures.push({ publicKey: privateKey.publicKey, signature });
          publicKeys.push(keyPair.public_key);
        }
      }),
    );

    addToTransaction && signatures.forEach(s => transaction.addSignature(s.publicKey, s.signature));

    return signatures;
  } catch (err: any) {
    throw Error(err.message || 'Failed to collect transaction signatures');
  }
};

/* Executes the transaction in the main process */
export const execute = async (
  transactionBytes: string,
  network: Network,
  customNetworkSettings: CustomNetworkSettings | null,
) => {
  try {
    return await window.electronAPI.transactions.executeTransaction(
      JSON.stringify({ transactionBytes, network, customNetworkSettings }),
    );
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Transaction Failed'));
  }
};

/* Executes the query in the main process */
export const executeQuery = async (
  queryBytes: string,
  network: Network,
  customNetworkSettings: CustomNetworkSettings | null,
  accountId: string,
  privateKey: string,
) => {
  try {
    return await window.electronAPI.transactions.executeQuery(
      JSON.stringify({ queryBytes, network, customNetworkSettings, accountId, privateKey }),
    );
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Query Execution Failed'));
  }
};

/* Saves transaction info */
export const storeTransaction = async (transaction: Tx) => {
  try {
    return await window.electronAPI.transactions.storeTransaction(transaction);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Saving transaction Failed'));
  }
};

/* Returns saved transactions */
export const getTransactions = async (user_id: string) => {
  try {
    return await window.electronAPI.transactions.getTransactions(user_id);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Getting transactions Failed'));
  }
};
