import {
  AccountId,
  PrivateKey,
  PublicKey,
  Timestamp,
  Transaction,
  TransactionId,
} from '@hashgraph/sdk';

import { IKeyPairWithAccountId } from '../../main/shared/interfaces';

import { CustomNetworkSettings, Network } from '../stores/storeNetwork';

import { decryptPrivateKey } from './keyPairService';

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
  keyPairs: IKeyPairWithAccountId[],
  transaction: Transaction,
  addToTransaction: boolean,
  email: string,
  password: string,
) => {
  const signatures: { publicKey: PublicKey; signature: Uint8Array }[] = [];
  const publicKeys: string[] = [];

  try {
    await Promise.all(
      keyPairs.map(async keyPair => {
        const privateKeyString = await decryptPrivateKey(email, password, keyPair.publicKey);

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
    return await window.electronAPI.utils.executeTransaction(
      JSON.stringify({ transactionBytes, network, customNetworkSettings }),
    );
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Transaction Failed';
    throw Error(message);
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
    return await window.electronAPI.utils.executeQuery(
      JSON.stringify({ queryBytes, network, customNetworkSettings, accountId, privateKey }),
    );
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Query Execution Failed';
    throw Error(message);
  }
};
