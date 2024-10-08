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

export const hasValidSignatureKey = (publicKeys: string[], key: Key) => {
  if (key instanceof KeyList) {
    const keys = key.toArray();
    let currentThreshold = 0;

    keys.forEach(key => {
      if (hasValidSignatureKey(publicKeys, key)) {
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

/**
 * Given a list of public keys and a key list, returns a list of public keys that are in the key list.
 *
 * @param publicKeys
 * @param keyList
 */
export function computeShortenedPublicKeyList(publicKeys: string[], keyList: KeyList): PublicKey[] {
  const result = [];
  const secondary = [];
  const threshold = keyList.threshold;

  /* Iterates through the key list, prioritizing PublicKeys over KeyLists */
  for (const key of keyList.toArray()) {
    if (key instanceof PublicKey) {
      const rawKey = key.toStringRaw();
      if (publicKeys.includes(rawKey)) {
        result.push(key);
        if (result.length === threshold) {
          return result;
        }
      }
    } else if (key instanceof KeyList) {
      const resultingKeys = computeShortenedPublicKeyList(publicKeys, key);
      if (resultingKeys && resultingKeys.length > 0) {
        secondary.push(resultingKeys);
      }
    }
  }

  /* If enough valid signatures were found from both key types, retrieve and merge the shortest arrays */
  if (result.length + secondary.length >= threshold) {
    secondary.sort((a, b) => a.length - b.length);
    return result.concat(secondary.slice(0, threshold - result.length).flat());
  }

  return null;
}