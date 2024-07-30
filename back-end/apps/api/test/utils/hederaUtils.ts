import * as crypto from 'crypto';

import { AccountId, Mnemonic, Timestamp, TransactionId } from '@hashgraph/sdk';

import { Network } from '../../../../libs/common/src/database/entities';

import { HederaAccount } from './models';

export const localnet2 = new HederaAccount()
  .setAccountId('0.0.2')
  .setPrivateKey(
    '302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137',
  );

export const localnet1002 = new HederaAccount()
  .setAccountId('0.0.1002')
  .setPrivateKey('0x7f109a9e3b0d8ecfba9cc23a3614433ce0fa7ddcc80f2a8f10b222179a5a80d6', 'ECDSA');

export const localnet1003 = new HederaAccount()
  .setAccountId('0.0.1003')
  .setPrivateKey('0x6ec1f2e7d126a74a1d2ff9e1c5d90b92378c725e506651ff8bb8616a5c724628', 'ECDSA');

export const localnet1004 = new HederaAccount()
  .setAccountId('0.0.1004')
  .setPrivateKey('0xb4d7f7e82f61d81c95985771b8abf518f9328d019c36849d4214b5f995d13814', 'ECDSA');

export const localnet1022 = new HederaAccount()
  .setAccountId('0.0.1022')
  .setPrivateKey('0xa608e2130a0a3cb34f86e757303c862bee353d9ab77ba4387ec084f881d420d4', 'ED25519');

export const generateMnemonic = () => {
  return Mnemonic.generate();
};

[localnet2, localnet1002, localnet1003, localnet1004, localnet1022].forEach(account => {
  account.setNetwork(Network.LOCAL_NODE);
});

export const generatePrivateKey = async (mnemonic?: Mnemonic) => {
  mnemonic = mnemonic || (await Mnemonic.generate());

  const index = 1;
  const privateKey = await mnemonic.toStandardECDSAsecp256k1PrivateKey('', index);
  const publicKey = privateKey.publicKey;
  const publicKeyRaw = publicKey.toStringRaw();
  const mnemonicWords = mnemonic.toString();
  const mnemonicHash = crypto.createHash('sha256').update(mnemonicWords).digest('hex');

  return { mnemonic, mnemonicWords, mnemonicHash, privateKey, publicKey, publicKeyRaw, index };
};

export const createTransactionId = (accountId: AccountId, date?: Date) =>
  TransactionId.withValidStart(accountId, Timestamp.fromDate(date || new Date()));
