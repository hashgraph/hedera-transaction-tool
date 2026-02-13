import * as crypto from 'crypto';
import * as bip39 from 'bip39';
import { proto } from '@hashgraph/proto';
import { Key, KeyList, PublicKey } from '@hashgraph/sdk';

// Generates an ECDSA key pair
export function generateECDSAKeyPair(curve = 'secp256k1') {
  const { privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: curve,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der',
    },
  });

  return privateKey.toString('hex');
}

// Generates an Ed25519 key pair
export function generateEd25519KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: {
      type: 'spki',
      format: 'der',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der',
    },
  });

  return {
    publicKey: publicKey.toString('hex'),
    privateKey: privateKey.toString('hex')
  };
}

export const decodeProtobuffKey = (protobuffEncodedKey: string) => {
  const buffer = Buffer.from(protobuffEncodedKey, 'hex');
  const protoKey = proto.Key.decode(buffer);
  return Key._fromProtobufKey(protoKey);
};

export const flattenKeyList = (keyList: Key) => {
  if (keyList instanceof PublicKey) {
    return [keyList];
  }

  if (!(keyList instanceof KeyList)) {
    throw new Error('Provided key is not a KeyList');
  }

  const keys: PublicKey[] = [];
  if (Array.isArray(keyList._keys)) {
    keyList._keys.forEach(key => {
      if (key instanceof PublicKey) {
        keys.push(key);
      } else if (key instanceof KeyList) {
        keys.push(...flattenKeyList(key));
      }
    });
  } else {
    console.error("KeyList does not have a 'keys' property or it's not an array", keyList);
    throw new Error('KeyList is malformed');
  }

  return keys;
};

export const decodeAndFlattenKeys = (protobuffEncodedKey: string) => {
  try {
    const decodedKey = decodeProtobuffKey(protobuffEncodedKey);

    const flatKeys = flattenKeyList(decodedKey);

    return flatKeys.map(key => key.toString());
  } catch (error) {
    console.error('Error decoding and flattening keys:', error);
    return [];
  }
};

// Generates a 24-word seed mnemonic phrase
export function generateMnemonic() {
  return bip39.generateMnemonic(256);
}
