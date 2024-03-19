import { Key, KeyList, PublicKey } from '@hashgraph/sdk';

//TODO if flattening the key should return a key[] in some other situation,
// change this method to do so. If not, rename the method to indicate it is
// returning bytes not keys

// Create an array containing the bytes of each key in the key.
export function flatPublicKeys(...keys: Key[]): Buffer[] {
  const keyBytes: Buffer[] = [];
  // If the key is null, return the empty array
  if (!keys) {
    return keyBytes;
  }
  for (const key of keys) {
    if (key instanceof KeyList) { // If the key is a KeyList, recursively call flatPublicKeys for each key in the list.
      keyBytes.concat(flatPublicKeys(...key.toArray()));
    } else if (key instanceof PublicKey) {  // If the key is a PublicKey, get the bytes and add it to the array
      keyBytes.push(Buffer.from(key.toBytes()));
    }
  }
  return keyBytes;
}

// I don't think runtime will allow the instanceof stuff above to work
// so I have these to try just in case
const isKeyList = (key: Key): key is KeyList => key instanceof KeyList;
const isPublicKey = (key: Key): key is PublicKey => key instanceof PublicKey;