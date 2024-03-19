import { proto } from '@hashgraph/proto';
import {
  AccountId,
  FileId,
  FileInfo,
  Hbar,
  HbarUnit,
  Key,
  KeyList,
  LedgerId,
  Long,
  PublicKey,
  Timestamp,
} from '@hashgraph/sdk';
import { HederaSpecialFileId } from '@main/shared/interfaces';

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
    } catch (error) {
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
    if (publicKeys.includes(key.toStringRaw())) {
      return true;
    } else {
      return false;
    }
  } else {
    throw new Error(`Invalid key type`);
  }
};

export function isHederaSpecialFileId(value: any): value is HederaSpecialFileId {
  const validValues: HederaSpecialFileId[] = [
    '0.0.101',
    '0.0.102',
    '0.0.111',
    '0.0.112',
    '0.0.121',
    '0.0.122',
    '0.0.123',
  ];

  return validValues.includes(value);
}

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

export function isPublicKeyInKeyList(publicKey: PublicKey, keyList: KeyList) {
  const keys = keyList.toArray();
  return keys.some(key => {
    if (key instanceof PublicKey) {
      return key.toStringRaw() === publicKey.toStringRaw();
    }
    return false;
  });
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

export function formatHbar(hbar: Hbar) {
  return hbar
    .toBigNumber()
    .toFixed(8)
    .replace(/\.0*$|(\.\d*[1-9])0+$/, '$1')
    .trim();
}

export function stringifyHbar(hbar: Hbar) {
  const denominations = [
    HbarUnit.Tinybar,
    HbarUnit.Microbar,
    HbarUnit.Millibar,
    HbarUnit.Hbar,
    HbarUnit.Kilobar,
    HbarUnit.Megabar,
    HbarUnit.Gigabar,
  ];

  if (
    hbar._valueInTinybar.isLessThan(HbarUnit.Microbar._tinybar) &&
    hbar._valueInTinybar.isGreaterThan(HbarUnit.Microbar._tinybar.negated())
  ) {
    return `${hbar.to(HbarUnit.Tinybar)} ${HbarUnit.Tinybar._symbol}`;
  }

  const checkCommonDenomination = (currentDenomination: HbarUnit, nextDenomination: HbarUnit) => {
    if (
      (hbar._valueInTinybar.isLessThan(nextDenomination._tinybar) &&
        hbar._valueInTinybar.isGreaterThanOrEqualTo(currentDenomination._tinybar)) ||
      (hbar._valueInTinybar.isGreaterThan(nextDenomination._tinybar.negated()) &&
        hbar._valueInTinybar.isLessThanOrEqualTo(currentDenomination._tinybar.negated()))
    ) {
      return `${hbar.to(currentDenomination)} ${currentDenomination._symbol}`;
    }

    return null;
  };

  for (let i = 1; i < denominations.length - 1; i++) {
    const result = checkCommonDenomination(denominations[i], denominations[i + 1]);
    if (result) return result;
  }

  if (
    hbar._valueInTinybar.isGreaterThanOrEqualTo(HbarUnit.Gigabar._tinybar) ||
    hbar._valueInTinybar.isLessThanOrEqualTo(HbarUnit.Megabar._tinybar.negated())
  ) {
    return `${hbar.to(HbarUnit.Gigabar)} ${HbarUnit.Gigabar._symbol}`;
  }

  throw new Error('Invalid Hbar');
}

export function getNodeNumbersFromNetwork(network: {
  [key: string]: string | AccountId;
}): number[] {
  const nodeNumbers: number[] = [];

  for (const key in network) {
    const nodeName = key.indexOf('node');

    if (nodeName >= 0) {
      nodeNumbers.push(Number(key.slice(nodeName + 4, nodeName + 6)));
    }
  }

  return nodeNumbers.sort((a, b) => a - b);
}
