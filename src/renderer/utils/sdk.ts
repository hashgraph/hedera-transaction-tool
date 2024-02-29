import { proto } from '@hashgraph/proto';
import {
  FileId,
  FileInfo,
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
