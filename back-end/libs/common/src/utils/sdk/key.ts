import { Key, KeyList, PublicKey } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

export function flattenKeyList(keyList: Key): PublicKey[] {
  if (keyList instanceof PublicKey) {
    return [keyList];
  }

  if (!(keyList instanceof KeyList)) {
    throw new Error('Invalid key list');
  }

  const keys: PublicKey[] = [];

  keyList.toArray().forEach(key => {
    if (key instanceof PublicKey) {
      keys.push(key);
    } else if (key instanceof KeyList) {
      const pks = flattenKeyList(key);
      pks.forEach(pk => {
        if (!keys.some(k => k.toStringRaw() === pk.toStringRaw())) {
          keys.push(pk);
        }
      });
    }
  });

  return keys;
}

export const ableToSign = (publicKeys: string[], key: Key) => {
  if (key instanceof KeyList) {
    const keys = key.toArray();
    let currentThreshold = 0;

    keys.forEach(key => {
      if (ableToSign(publicKeys, key)) {
        currentThreshold++;
      }
    });

    return currentThreshold >= (key.threshold || keys.length);
  } else if (key instanceof PublicKey) {
    if (publicKeys.includes(key.toStringRaw())) {
      return true;
    } else {
      return false;
    }
  } else throw new Error(`Invalid key type`);
};

export const decodeProtobuffKey = (protobuffEncodedKey: string) => {
  const buffer = Buffer.from(protobuffEncodedKey, 'hex');
  const protoKey = proto.Key.decode(buffer);

  return Key._fromProtobufKey(protoKey);
};

export function isPublicKeyInKeyList(publicKey: PublicKey | string, keyList: KeyList) {
  publicKey = publicKey instanceof PublicKey ? publicKey.toStringRaw() : publicKey;

  const keys = keyList.toArray();
  return keys.some(key => {
    if (key instanceof PublicKey) {
      return key.toStringRaw() === publicKey;
    } else if (key instanceof KeyList) {
      return isPublicKeyInKeyList(publicKey, key);
    }
    return false;
  });
}
