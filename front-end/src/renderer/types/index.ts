import { Transaction } from '@hashgraph/sdk';

export * from './userStore';

export enum KeyType {
  ED25519 = 'ED25519',
  ECDSA = 'ECDSA',
}

export type SignatureItem = {
  publicKeys: string[];
  transaction: Transaction;
  transactionId: number;
};
