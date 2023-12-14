import { Key, KeyList } from '@hashgraph/sdk';

export const openExternal = (url: string) => window.electronAPI.utils.openExternal(url);

export const decodeProtobuffKey = async (protobuffKey: string) => {
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
