import { Key, KeyList, PublicKey } from '@hashgraph/sdk';
import * as HashgraphProto from '@hashgraph/proto';

export const openExternal = (url: string) => window.electronAPI.utils.openExternal(url);

export const decodeProtobuffKey = async (
  protobuffKey: string,
): Promise<KeyList | Key | undefined> => {
  const key = await window.electronAPI.utils.decodeProtobuffKey(protobuffKey);

  if (key.thresholdKey) {
    return KeyList.__fromProtobufThresoldKey(key.thresholdKey);
  }
  if (key.keyList) {
    return KeyList.__fromProtobufKeyList(key.keyList);
  }
  if (key.ed25519 || key.ECDSASecp256k1) {
    return Key._fromProtobufKey(key);
  }
};

export const decodeProtobuffKeyNormalized = async (protobuffKey: string) => {
  const key = await window.electronAPI.utils.decodeProtobuffKey(protobuffKey);

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
  }

  return formatKey(key);
};
