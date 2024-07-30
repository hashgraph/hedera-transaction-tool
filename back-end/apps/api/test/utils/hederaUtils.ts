import { Mnemonic } from '@hashgraph/sdk';
import * as crypto from 'crypto';

export const generateMnemonic = () => {
  return Mnemonic.generate();
};

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
