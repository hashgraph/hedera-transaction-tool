import { proto } from '@hashgraph/proto';
import { FileId, FileInfo, Key, KeyList, LedgerId, Long, Timestamp } from '@hashgraph/sdk';

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
