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

export const decodeProtobuffKey = (protobuffEncodedKey: string) => {
  const buffer = Buffer.from(protobuffEncodedKey, 'hex');
  const protoKey = proto.Key.decode(buffer);

  return Key._fromProtobufKey(protoKey);
};
