import { proto } from '@hiero-ledger/proto';
import {
  Client,
  FileDeleteTransaction,
  FileInfo,
  FileInfoQuery,
  PrivateKey,
} from '@hiero-ledger/sdk';

const LOCALNET_OPERATOR_ACCOUNT_ID = '0.0.2';
// Default localnet operator key for account 0.0.2 (ED25519 PKCS8 DER, hex-encoded).
// This key is used only to pay for the FileDeleteTransaction; the file admin key signature is added separately.
const LOCALNET_OPERATOR_PRIVATE_KEY_DER_HEX =
  '302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137';

export function encodeFileInfo(fileInfo: FileInfo): string {
  const protoBuf = {
    fileID: fileInfo.fileId._toProtobuf(),
    size: fileInfo.size,
    expirationTime: fileInfo.expirationTime._toProtobuf(),
    deleted: fileInfo.isDeleted,
    keys: fileInfo.keys._toProtobufKey().keyList,
    memo: fileInfo.fileMemo,
    ledgerId: fileInfo.ledgerId != null ? fileInfo.ledgerId.toBytes() : null,
  };

  return proto.FileGetInfoResponse.FileInfo.encode(protoBuf).finish().join(',');
}

export async function deleteFileFromNetwork(
  fileId: string,
  fileAdminPrivateKeyDerHex: string,
): Promise<string> {
  const operatorKey = PrivateKey.fromStringDer(LOCALNET_OPERATOR_PRIVATE_KEY_DER_HEX);
  const fileAdminKey = PrivateKey.fromStringDer(fileAdminPrivateKeyDerHex);

  const client = Client.forLocalNode();
  client.setOperator(LOCALNET_OPERATOR_ACCOUNT_ID, operatorKey);

  const signedTx = await new FileDeleteTransaction()
    .setFileId(fileId)
    .freezeWith(client)
    .sign(fileAdminKey);

  const response = await signedTx.execute(client);

  await response.getReceipt(client);

  const deletedFileInfo = await new FileInfoQuery().setFileId(fileId).execute(client);
  return encodeFileInfo(deletedFileInfo);
}
