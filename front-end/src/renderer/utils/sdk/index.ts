import type { ITransactionApprover } from '@shared/interfaces/organization/approvers';

import {
  AccountId,
  Client,
  ContractId,
  FileId,
  FileInfo,
  Hbar,
  HbarUnit,
  Key,
  KeyList,
  LedgerId,
  Long,
  NodeAddressBook,
  PrivateKey,
  PublicKey,
  SignatureMap,
  Timestamp,
  Transaction,
} from '@hashgraph/sdk';
import { KeyType } from '../../types';

import { proto } from '@hashgraph/proto';

import { getNetworkNodes } from '@renderer/services/mirrorNodeDataService';

import { hexToUint8Array, isAccountId, isContractId, uint8ToHex } from '..';
import { getNodeAddressBook } from '@renderer/services/sdkService';

export * from './createTransactions';
export * from './getData';
export * from './validation';

export const createFileInfo = (props: {
  fileId: FileId | string;
  size: Long | number;
  expirationTime: Timestamp | Date;
  isDeleted: boolean;
  keys: KeyList | Key[];
  fileMemo: string;
  ledgerId: LedgerId | null;
}): Uint8Array => {
  if (typeof props.fileId === 'string') {
    try {
      props.fileId = FileId.fromString(props.fileId);
    } catch {
      props.fileId = FileId.fromString('0');
    }
  }

  if (typeof props.size === 'number') {
    props.size = Long.fromNumber(props.size);
  }

  if (!(props.keys instanceof KeyList)) {
    props.keys = KeyList.from(props.keys || []);
  }

  // @ts-expect-error The constructor is private, but I want to create such object
  const fileInfo = new FileInfo(props);

  const protoBuf = {
    fileID: fileInfo.fileId._toProtobuf(),
    size: fileInfo.size,
    expirationTime: fileInfo.expirationTime._toProtobuf(),
    deleted: fileInfo.isDeleted,
    keys: fileInfo.keys._toProtobufKey().keyList,
    memo: fileInfo.fileMemo,
    ledgerId: fileInfo.ledgerId != null ? fileInfo.ledgerId.toBytes() : null,
  };

  return proto.FileGetInfoResponse.FileInfo.encode(protoBuf).finish();
};

/**
 * Gets the public key and its type.
 * @param key - The key to get the public key from.
 * @returns {object} - An object containing the public key and the key type.
 */
export const getPublicKeyAndType = (key: string | PublicKey): { publicKey: PublicKey, keyType: KeyType } => {
  let publicKey: PublicKey;

  if (key instanceof PublicKey) {
    publicKey = key;
  } else {
    publicKey = PublicKey.fromString(key)
  }

  const keyType = publicKey._toProtobufKey().ed25519 ? KeyType.ED25519 : KeyType.ECDSA;

  return { publicKey, keyType };
};

export const normalizePublicKey = (key: Key) => {
  const protoBuffKey = key._toProtobufKey();

  if (protoBuffKey.ed25519) {
    return PublicKey.fromBytesED25519(protoBuffKey.ed25519).toStringRaw();
  } else if (protoBuffKey.ECDSASecp256k1) {
    return PublicKey.fromBytesECDSA(protoBuffKey.ECDSASecp256k1).toStringRaw();
  }
  return '';
};

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
    return publicKeys.includes(key.toStringRaw());
  } else {
    throw new Error(`Invalid key type`);
  }
};

export function getMinimumExpirationTime() {
  const now = new Date();
  now.setDate(now.getDate() + 30);
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return now;
}

export function getMaximumExpirationTime() {
  const now = new Date();
  now.setDate(now.getDate() + 92);
  return now;
}

export function isPublicKeyInKeyList(publicKey: PublicKey | string, key: Key): boolean {
  if (key instanceof PublicKey) {
    return key.toStringRaw() === (publicKey instanceof PublicKey ? publicKey.toStringRaw() : publicKey);
  }

  if (key instanceof KeyList) {
    const keys = key.toArray();
    return keys.some(k => isPublicKeyInKeyList(publicKey, k));
  }

  return false;
}

export function isKeyListValid(keyList: KeyList) {
  const keys = keyList.toArray();

  if (keys.length === 0 || (keyList.threshold && keyList.threshold > keys.length)) {
    return false;
  }

  const everyNestedKeyValid = keys.every(key => {
    if (key instanceof KeyList && !isKeyListValid(key)) {
      return false;
    } else {
      return true;
    }
  });

  return everyNestedKeyValid;
}

export function encodeKey(keyList: Key) {
  const ikey = keyList._toProtobufKey();
  return proto.Key.encode(ikey).finish();
}

export function compareKeys(key1: Key, key2: Key) {
  if (key1 instanceof PublicKey && key2 instanceof PublicKey) {
    return key1.equals(key2);
  } else if (key1 instanceof KeyList && key2 instanceof KeyList) {
    if (key1.threshold !== key2.threshold) return false;
    const keys1 = key1.toArray();
    const keys2 = key2.toArray();
    if (keys1.length !== keys2.length) return false;

    const keys2Copy = [...keys2];
    for (const key of keys1) {
      const idx = keys2Copy.findIndex(k => compareKeys(key, k));
      if (idx === -1) return false;
      keys2Copy.splice(idx, 1);
    }
    return true;
  }
  return false;
}

export function decodeKeyList(keyListBytes: string) {
  const bytesArray = Uint8Array.from(keyListBytes.split(',').map(b => Number(b)));
  const protoKey = proto.Key.decode(bytesArray);
  const key = Key._fromProtobufKey(protoKey);

  if (key instanceof KeyList) {
    return key;
  } else {
    throw new Error('Invalid key list');
  }
}

export const decodeProtobuffKey = (protobuffKey: string): Key | null => {
  try {
    const key = proto.Key.decode(hexToUint8Array(protobuffKey));

    if (key.thresholdKey) {
      return KeyList.__fromProtobufThresoldKey(key.thresholdKey);
    }
    if (key.keyList) {
      return KeyList.__fromProtobufKeyList(key.keyList);
    }
    if (key.ed25519 || key.ECDSASecp256k1) {
      return Key._fromProtobufKey(key);
    }

    return null;
  } catch {
    throw new Error('Failed to decode protobuf');
  }
};

export function formatHbar(hbar: Hbar) {
  return hbar
    .toBigNumber()
    .toFixed(8)
    .replace(/\.0*$|(\.\d*[1-9])0+$/, '$1')
    .trim();
}

export function stringifyHbar(hbar: Hbar) {
  return hbar.toBigNumber().eq(0)
    ? `0 ${HbarUnit.Hbar._symbol}`
    : `${hbar.to(HbarUnit.Hbar).toString()} ${HbarUnit.Hbar._symbol}`;
}

// export function stringifyHbar(hbar: Hbar) {
//   const denominations = [
//     HbarUnit.Tinybar,
//     HbarUnit.Microbar,
//     HbarUnit.Millibar,
//     HbarUnit.Hbar,
//     HbarUnit.Kilobar,
//     HbarUnit.Megabar,
//     HbarUnit.Gigabar,
//   ];

//   if (
//     hbar._valueInTinybar.isLessThan(HbarUnit.Microbar._tinybar) &&
//     hbar._valueInTinybar.isGreaterThan(HbarUnit.Microbar._tinybar.negated())
//   ) {
//     return `${hbar.to(HbarUnit.Tinybar)} ${HbarUnit.Tinybar._symbol}`;
//   }

//   const checkCommonDenomination = (currentDenomination: HbarUnit, nextDenomination: HbarUnit) => {
//     if (
//       (hbar._valueInTinybar.isLessThan(nextDenomination._tinybar) &&
//         hbar._valueInTinybar.isGreaterThanOrEqualTo(currentDenomination._tinybar)) ||
//       (hbar._valueInTinybar.isGreaterThan(nextDenomination._tinybar.negated()) &&
//         hbar._valueInTinybar.isLessThanOrEqualTo(currentDenomination._tinybar.negated()))
//     ) {
//       return `${hbar.to(currentDenomination)} ${currentDenomination._symbol}`;
//     }

//     return null;
//   };

//   for (let i = 1; i < denominations.length - 1; i++) {
//     const result = checkCommonDenomination(denominations[i], denominations[i + 1]);
//     if (result) return result;
//   }

//   if (
//     hbar._valueInTinybar.isGreaterThanOrEqualTo(HbarUnit.Gigabar._tinybar) ||
//     hbar._valueInTinybar.isLessThanOrEqualTo(HbarUnit.Megabar._tinybar.negated())
//   ) {
//     return `${hbar.to(HbarUnit.Gigabar)} ${HbarUnit.Gigabar._symbol}`;
//   }

//   throw new Error('Invalid Hbar');
// }

export async function getNodeNumbersFromNetwork(mirrorNodeRESTURL: string): Promise<number[]> {
  const networkNodes = await getNetworkNodes(mirrorNodeRESTURL);

  return networkNodes.reduce<number[]>((acc, node) => {
    if (node.node_id !== undefined) {
      acc.push(node.node_id);
    }
    return acc;
  }, []);
}

export const getPrivateKey = (
  publicKey: string | PublicKey,
  privateKeyString: string,
): PrivateKey => {
  publicKey = publicKey instanceof PublicKey ? publicKey : PublicKey.fromString(publicKey);

  const startsWithHex = privateKeyString.startsWith('0x');

  const privateKey =
    publicKey._key._type === 'secp256k1'
      ? PrivateKey.fromStringECDSA(`${startsWithHex ? '' : '0x'}${privateKeyString}`)
      : PrivateKey.fromStringED25519(privateKeyString);

  return privateKey;
};

export const isExpired = (transaction: Transaction) => {
  if (!transaction.transactionId?.validStart) {
    return true;
  }

  const validStart = transaction.transactionId.validStart.toDate();
  const duration = transaction.transactionValidDuration;

  return new Date().getTime() >= validStart.getTime() + duration * 1_000;
};

export const getTransactionBodySignatureWithoutNodeAccountId = (
  privateKey: PrivateKey,
  transaction: Transaction,
) => {
  // @ts-expect-error - _makeTransactionBody is a private method
  const transactionBody = transaction._makeTransactionBody(null);
  const bodyBytes = proto.TransactionBody.encode(transactionBody).finish();

  const signature = privateKey.sign(bodyBytes);
  return uint8ToHex(signature);
};

export const isApproved = (approver: ITransactionApprover): boolean | null => {
  if (approver.approved === false) {
    return false;
  }

  if (approver.approved === true) {
    return true;
  }

  if (approver.approvers) {
    const approvals = approver.approvers.filter(approver => isApproved(approver) === true);
    const rejections = approver.approvers.filter(approver => isApproved(approver) === false);
    if (approvals.length >= (approver.threshold || approvals.length)) {
      return true;
    }
    return rejections.length >= (approver.threshold || rejections.length) ? false : null;
  }

  return null;
};

export const formatAccountId = (accountId: string) => {
  if (isAccountId(accountId) && !/^0+/.test(accountId)) {
    return AccountId.fromString(accountId).toString();
  } else {
    return accountId;
  }
};

export const formatContractId = (contractId: string) => {
  if (isContractId(contractId)) {
    return ContractId.fromString(contractId).toString();
  } else {
    return contractId;
  }
};

export const getClientFromMirrorNode = async (mirrorNetwork: string) => {
  const mirrorNodeGRPC = mirrorNetwork.endsWith(':443') ? mirrorNetwork : `${mirrorNetwork}:443`;

  const nodeAddressBookProto = await getNodeAddressBook(mirrorNodeGRPC);

  nodeAddressBookProto.nodeAddress?.forEach(node => {
    if (node.nodeAccountId?.shardNum) {
      node.nodeAccountId.shardNum = Long.fromValue(node.nodeAccountId.shardNum);
    }
    if (node.nodeAccountId?.accountNum) {
      node.nodeAccountId.accountNum = Long.fromValue(node.nodeAccountId.accountNum);
    }
    if (node.nodeAccountId?.realmNum) {
      node.nodeAccountId.realmNum = Long.fromValue(node.nodeAccountId.realmNum);
    }
  });

  const nodeAddressBook = NodeAddressBook._fromProtobuf(nodeAddressBookProto);

  const client = Client.forNetwork({})
    .setMirrorNetwork(mirrorNodeGRPC)
    .setNetworkFromAddressBook(nodeAddressBook);

  return client;
};

export const getSignatureMapForPublicKeys = (publicKeys: string[], transaction: Transaction) => {
  const signatureMap = new SignatureMap();
  const allSignatures = transaction.getSignatures();

  const nodeAccountIds = allSignatures.keys();
  for (const nodeAccountId of nodeAccountIds) {
    const transactionIds = allSignatures.get(nodeAccountId)?.keys() || [];

    for (const transactionId of transactionIds) {
      const signatures = allSignatures.get(nodeAccountId)?.get(transactionId);

      if (signatures) {
        for (const publicKeyString of publicKeys) {
          const publicKey = PublicKey.fromString(publicKeyString);

          const signature = signatures.get(publicKey);
          if (signature) {
            signatureMap.addSignature(nodeAccountId, transactionId, publicKey, signature);
          }
        }
      }
    }
  }

  return signatureMap;
};

export const formatSignatureMap = (signatureMap: SignatureMap) => {
  const result: {
    [nodeAccountId: string]: { [transactionId: string]: { [publicKey: string]: string } };
  } = {};
  for (const [nodeAccountId, transactions] of signatureMap._map) {
    result[nodeAccountId] = {};
    for (const [transactionId, signatures] of transactions._map) {
      result[nodeAccountId][transactionId] = {};
      for (const [publicKey, signature] of signatures._map) {
        result[nodeAccountId][transactionId][publicKey] = uint8ToHex(signature);
      }
    }
  }
  return result;
};

export const parseHbar = (hbar: number | null, unit: HbarUnit): Hbar | null => {
  hbar = parseInt(hbar?.toString() || '');
  if (!hbar) {
    return null;
  }

  if (hbar < 0) {
    return null;
  }

  return Hbar.from(hbar, unit);
};
