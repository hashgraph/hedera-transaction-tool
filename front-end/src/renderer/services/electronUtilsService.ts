import { Key, KeyList, PublicKey } from '@hashgraph/sdk';
import * as HashgraphProto from '@hashgraph/proto';

/* Electron Utilities Service */

/* Open external URL */
export const openExternal = (url: string) => window.electronAPI.local.utils.openExternal(url);

/* Decode Protobuff encoded key */
export const decodeProtobuffKey = async (protobuffKey: string): Promise<Key | undefined> => {
  try {
    const key = await window.electronAPI.local.utils.decodeProtobuffKey(protobuffKey);

    if (key.thresholdKey) {
      return KeyList.__fromProtobufThresoldKey(key.thresholdKey);
    }
    if (key.keyList) {
      return KeyList.__fromProtobufKeyList(key.keyList);
    }
    if (key.ed25519 || key.ECDSASecp256k1) {
      return Key._fromProtobufKey(key);
    }

    return undefined;
  } catch (error) {
    throw new Error('Failed to decode protobuf');
  }
};

/* Decode Protobuff encoded key to KeyList or Public key */
export const decodeProtobuffKeyNormalized = async (protobuffKey: string) => {
  try {
    const key = await window.electronAPI.local.utils.decodeProtobuffKey(protobuffKey);

    return formatKey(key);
  } catch (error) {
    throw new Error('Failed to decode protobuf');
  }

  function formatKey(key: HashgraphProto.proto.IKey) {
    if (key.thresholdKey && key.thresholdKey.keys) {
      const keys: any = key.thresholdKey.keys.keys?.map(key => formatKey(key));

      const thresholdKey = {
        threshold: key.thresholdKey.threshold,
        keys: keys,
      };

      return thresholdKey;
    } else if (key.keyList && key.keyList.keys) {
      if (key.keyList.keys.length === 1) {
        return getPublicKeyFromIKey(key.keyList.keys[0]);
      }

      const keys = key.keyList.keys.map(k => getPublicKeyFromIKey(k)).filter(k => k) as PublicKey[];

      return {
        threshold: key.keyList.keys.length,
        keys: keys.filter(k => k),
      };
    } else {
      return getPublicKeyFromIKey(key);
    }
  }

  function getPublicKeyFromIKey(ikey: HashgraphProto.proto.IKey) {
    if (ikey.ed25519) {
      return PublicKey.fromBytesED25519(ikey.ed25519);
    }
    if (ikey.ECDSASecp256k1) {
      return PublicKey.fromBytesECDSA(ikey.ECDSASecp256k1);
    }

    return undefined;
  }
};

/* Converts Uint8Array to hex string */
export const uint8ArrayToHex = async (data: Uint8Array) => {
  try {
    return await window.electronAPI.local.utils.uint8ArrayToHex(data);
  } catch (error) {
    throw new Error('Failed to convert UInt8Array to hex string');
  }
};
