import { AccountId, PrivateKey, PublicKey } from '@hashgraph/sdk';

export const ecdsaDerPrefix = '3030020100300706052b8104000a04220420';
export const ecdsaDerPrefix2 = '30540201010420';
export const ed25519DerPrefix = '302e020100300506032b657004220420';

export class HederaAccount {
  accountId: AccountId;
  privateKey: PrivateKey;
  accountIdRaw: string;
  privateKeyRaw: string;
  publicKey: PublicKey;
  publicKeyRaw: string;
  mirrorNetwork: string;

  setAccountId(accountId: string) {
    this.accountId = AccountId.fromString(accountId);
    this.accountIdRaw = accountId;

    return this;
  }

  setPrivateKey(key: string, type?: 'ECDSA' | 'ED25519') {
    const isDer =
      key.startsWith(ecdsaDerPrefix) ||
      key.startsWith(ecdsaDerPrefix2) ||
      key.startsWith(ed25519DerPrefix);

    if (!isDer && type !== 'ED25519' && type !== 'ECDSA') {
      throw new Error('Invalid private key type');
    }

    if (isDer) {
      this.privateKey = PrivateKey.fromStringDer(key);
    } else {
      key = key.startsWith('0x') ? key.slice(2) : key;

      this.privateKey =
        type === 'ECDSA' ? PrivateKey.fromStringECDSA(key) : PrivateKey.fromStringED25519(key);
    }

    this.privateKeyRaw = this.privateKey.toStringRaw();

    this.publicKey = this.privateKey.publicKey;
    this.publicKeyRaw = this.publicKey.toStringRaw();

    return this;
  }

  setNetwork(mirrorNetwork: string) {
    this.mirrorNetwork = mirrorNetwork;

    return this;
  }
}
