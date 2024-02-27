import {expect} from 'vitest';
import {FileId} from '@hashgraph/sdk';

import {JSONtoUInt8Array} from '@main/utils';

import {
  decodeProto,
  encodeHederaSpecialFile,
  isHederaSpecialFileId,
} from '@main/utils/hederaSpecialFiles';

import type {HederaSpecialFileId} from '../../../../types/interfaces';

import {
  buffer as buffer101,
  decodedString as string101,
  protoInput as protoInput101,
} from '../_constants_/0.0.101';
import {
  buffer as buffer102,
  decodedString as string102,
  protoInput as protoInput102,
} from '../_constants_/0.0.102';
import {buffer as buffer111, decodedString as string111} from '../_constants_/0.0.111';
import {buffer as buffer112, decodedString as string112} from '../_constants_/0.0.112';
import {buffer as buffer121, decodedString as string121} from '../_constants_/0.0.121';
import {buffer as buffer122, decodedString as string122} from '../_constants_/0.0.122';
import {buffer as buffer123, decodedString as string123} from '../_constants_/0.0.123';

describe('Hedera Special Files utilities', () => {
  test('isHederaSpecialFileId: validates that a file is special', () => {
    const fileId = new FileId(101);

    const flag = isHederaSpecialFileId(fileId.toString());

    expect(flag).toBe(true);
  });

  test('decodeProto: decodes special files', () => {
    const file_101 = new FileId(101);

    const decoded_101 = decodeProto(file_101.toString() as HederaSpecialFileId, buffer101);

    expect(decoded_101).toBe(string101);

    const file_102 = new FileId(102);

    const decoded_102 = decodeProto(file_102.toString() as HederaSpecialFileId, buffer102);

    expect(decoded_102).toBe(string102);

    const file_111 = new FileId(111);

    const decoded_111 = decodeProto(file_111.toString() as HederaSpecialFileId, buffer111);

    expect(decoded_111).toBe(string111);

    const file_112 = new FileId(112);

    const decoded_112 = decodeProto(file_112.toString() as HederaSpecialFileId, buffer112);

    expect(decoded_112).toBe(string112);

    const file_121 = new FileId(121);

    const decoded_121 = decodeProto(file_121.toString() as HederaSpecialFileId, buffer121);

    expect(decoded_121).toBe(string121);

    const file_122 = new FileId(122);

    const decoded_122 = decodeProto(file_122.toString() as HederaSpecialFileId, buffer122);

    expect(decoded_122).toBe(string122);

    const file_123 = new FileId(123);

    const decoded_123 = decodeProto(file_123.toString() as HederaSpecialFileId, buffer123);

    expect(decoded_123).toBe(string123);
  });

  test('decodeProto: returns undefined if id of non-special file is provided', () => {
    const fileId = new FileId(13123);

    expect(() => decodeProto(fileId.toString() as HederaSpecialFileId, [])).toThrowError(
      'File ID is not Hedera special file',
    );
  });

  test('encodeHederaSpecialFile: encodes every type of special file', () => {
    /* File 101 */
    const fileId_101 = new FileId(101);
    const content_101 = JSONtoUInt8Array(protoInput101);

    const encoded_101 = encodeHederaSpecialFile(
      content_101,
      fileId_101.toString() as HederaSpecialFileId,
    );

    expect(decodeProto(fileId_101.toString() as HederaSpecialFileId, encoded_101)).toBe(string101);

    /* File 102 */
    const fileId_102 = new FileId(102);
    const content_102 = JSONtoUInt8Array(protoInput102);

    const encoded_102 = encodeHederaSpecialFile(
      content_102,
      fileId_102.toString() as HederaSpecialFileId,
    );

    expect(decodeProto(fileId_102.toString() as HederaSpecialFileId, encoded_102)).toBe(string102);
  });

  test('encodeHederaSpecialFile: throws if file is not special', () => {
    const fileId = new FileId(10123);

    expect(() =>
      encodeHederaSpecialFile(Uint8Array.from([]), fileId.toString() as HederaSpecialFileId),
    ).toThrowError('File is not special');
  });
});
