import { expect } from 'vitest';
import { proto } from '@hiero-ledger/proto';
import { FileId, Long } from '@hiero-ledger/sdk';

import { JSONtoUInt8Array } from '@main/utils';

import {
  decodeProto,
  encodeHederaSpecialFile,
  isHederaSpecialFileId,
} from '@shared/hederaSpecialFiles';
import { HederaSpecialFileId } from '@shared/interfaces';

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
import {
  buffer as buffer111,
  decodedString as string111,
  protoInput as protoInput111,
} from '../_constants_/0.0.111';
import {
  buffer as buffer112,
  decodedString as string112,
  protoInput as protoInput112,
} from '../_constants_/0.0.112';
import {
  buffer as buffer121,
  decodedString as string121,
  protoInput as protoInput121,
} from '../_constants_/0.0.121';
import {
  buffer as buffer122,
  decodedString as string122,
  protoInput as protoInput122,
} from '../_constants_/0.0.122';
import {
  buffer as buffer123,
  decodedString as string123,
  protoInput as protoInput123,
} from '../_constants_/0.0.123';
import {
  accountId,
  nonFormattedDecode as nonFormattedDecodeSpecialFile,
} from '../_constants_/nonSpecialFile';

function expectedReview(text: string, fileId: number, bytes: Uint8Array | number[]) {
  let value;
  if (fileId === 121 || fileId === 122) {
    value = {
      nameValue: text.split('\n').map(line => {
        const index = line.indexOf('=');
        return { name: line.slice(0, index), value: line.slice(index + 1), data: '' };
      }),
    };
  } else {
    value = JSON.parse(text);
    if (fileId === 101 || fileId === 102) {
      for (const node of value.nodeAddress) {
        node.nodeCertHash = `0x${Buffer.from(node.nodeCertHash).toString('hex')}`;
      }
    }
  }
  return JSON.stringify(
    { ...value, originalBytesHex: Buffer.from(bytes).toString('hex') },
    null,
    2,
  );
}

function withoutReviewMetadata(review: string) {
  const { warning: _warning, originalBytesHex: _hex, ...content } = JSON.parse(review);
  return JSON.stringify(content, null, 2);
}

describe('Hedera Special Files utilities', () => {
  test.each(['0.0.121', '0.0.122'] as const)(
    '%s distinguishes embedded separators, invisible characters and binary data',
    fileId => {
      const review = (nameValue: proto.ISetting[]) =>
        decodeProto(fileId, proto.ServicesConfigurationList.encode({ nameValue }).finish());
      for (const separator of ['\n', '\r', '=']) {
        const forged = review([
          { name: 'getAccountDetails', value: `2-50${separator}cryptoTransfer=2-55` },
        ]);
        const separate = review([
          { name: 'getAccountDetails', value: '2-50' },
          { name: 'cryptoTransfer', value: '2-55' },
        ]);
        expect(forged).not.toBe(separate);
        expect(JSON.parse(forged).nameValue).toHaveLength(1);
        expect(JSON.parse(forged).nameValue[0].value).toBe(`2-50${separator}cryptoTransfer=2-55`);
      }
      const invisible = review([{ name: 'key\u202e\u200b', value: 'x\b\u0085\u2028' }]);
      expect(invisible).not.toMatch(/[\u202e\u200b\u0085\u2028\x08]/u);
      expect(invisible).toContain('key\\u202e\\u200b');
      expect(review([{ name: 'a=b', value: 'c' }])).not.toBe(review([{ name: 'a', value: 'b=c' }]));
      const withData = review([{ name: 'key', value: 'value', data: Uint8Array.of(0xff, 0x00) }]);
      expect(JSON.parse(withData).nameValue[0].data).toBe('/wA=');
      expect(withData).not.toBe(review([{ name: 'key', value: 'value' }]));
    },
  );

  test.each(['0.0.101', '0.0.102'] as const)(
    '%s renders hashes losslessly without requiring a hash',
    fileId => {
      const review = (node: proto.INodeAddress) =>
        decodeProto(fileId, proto.NodeAddressBook.encode({ nodeAddress: [node] }).finish());
      const first = review({ nodeCertHash: Uint8Array.of(0xff) });
      const second = review({ nodeCertHash: Uint8Array.of(0xfe) });
      expect(JSON.parse(first).nodeAddress[0].nodeCertHash).toBe('0xff');
      expect(JSON.parse(second).nodeAddress[0].nodeCertHash).toBe('0xfe');
      expect(first).not.toBe(second);
      const noHash = JSON.parse(
        review({
          nodeId: Long.fromNumber(7),
          serviceEndpoint: [{ ipAddressV4: Uint8Array.of(1, 2, 3, 4) }],
        }),
      );
      expect(noHash.nodeAddress[0].nodeId).toBe('7');
      expect(noHash.nodeAddress[0].serviceEndpoint[0].ipAddressV4).toBe('1.2.3.4');
    },
  );

  test.each(['0.0.101', '0.0.102'] as const)(
    '%s distinguishes account-ID encodings that format identically',
    fileId => {
      // Empty AccountID, explicit accountNum: 0, and explicit empty alias.
      // Each survives protobuf round-tripping, but all format as 0.0.0.
      const encodings = ['0a023200', '0a0432021800', '0a0432022200'];
      const reviews = encodings.map(hex => {
        const bytes = Buffer.from(hex, 'hex');
        expect(proto.NodeAddressBook.encode(proto.NodeAddressBook.decode(bytes)).finish()).toEqual(
          bytes,
        );
        const review = decodeProto(fileId, bytes);
        const parsed = JSON.parse(review);
        expect(parsed.nodeAddress[0].nodeAccountId).toBe('0.0.0');
        expect(parsed).not.toHaveProperty('warning');
        expect(parsed.originalBytesHex).toBe(hex);
        return review;
      });

      expect(new Set(reviews).size).toBe(encodings.length);
      expect(new Set(reviews.map(withoutReviewMetadata)).size).toBe(1);
    },
  );

  test('includes original bytes without a warning for canonically encoded contents', () => {
    const bytes = proto.ServicesConfigurationList.encode({
      nameValue: [{ name: 'key', value: 'value' }],
    }).finish();
    const review = JSON.parse(decodeProto('0.0.121', bytes));
    expect(review).not.toHaveProperty('warning');
    expect(review.originalBytesHex).toBe(Buffer.from(bytes).toString('hex'));
  });

  test.each(['0.0.121', '0.0.122'] as const)(
    '%s flags noncanonical field order while preserving the original bytes',
    fileId => {
      // Setting { name: "k", value: "x" }, with value encoded before name.
      // Both fields are known and occur once; only the encoding order differs.
      const noncanonical = Buffer.from('0a061201780a016b', 'hex');
      const canonical = Buffer.from('0a060a016b120178', 'hex');
      const reencoded = proto.ServicesConfigurationList.encode(
        proto.ServicesConfigurationList.decode(noncanonical),
      ).finish();
      expect(reencoded).toEqual(canonical);
      expect(noncanonical).not.toEqual(canonical);

      const review = decodeProto(fileId, noncanonical);
      const canonicalReview = decodeProto(fileId, canonical);
      expect(withoutReviewMetadata(review)).toBe(withoutReviewMetadata(canonicalReview));
      expect(JSON.parse(review).nameValue).toEqual([{ name: 'k', value: 'x', data: '' }]);
      expect(JSON.parse(review).warning).toContain('non-canonical encoding');
      expect(JSON.parse(review).originalBytesHex).toBe(noncanonical.toString('hex'));
      expect(JSON.parse(canonicalReview)).not.toHaveProperty('warning');
      expect(JSON.parse(canonicalReview).originalBytesHex).toBe(canonical.toString('hex'));
    },
  );

  test('flags unknown fields that decoding discards', () => {
    const bytes = proto.ServicesConfigurationList.encode({
      nameValue: [{ name: 'key', value: 'value' }],
    }).finish();
    // Unknown field 15, varint 1.
    const unknownField = Uint8Array.from([...bytes, 0x78, 0x01]);
    const review = JSON.parse(decodeProto('0.0.121', unknownField));
    expect(review.nameValue).toEqual(JSON.parse(decodeProto('0.0.121', bytes)).nameValue);
    expect(review.warning).toContain('not shown');
    expect(review.originalBytesHex).toBe(Buffer.from(unknownField).toString('hex'));
  });

  test('flags duplicate scalar fields where only the last value is kept', () => {
    // Setting { name: "a", name: "b" } wrapped in nameValue (field 1)
    const bytes = Uint8Array.from([0x0a, 0x06, 0x0a, 0x01, 0x61, 0x0a, 0x01, 0x62]);
    const review = JSON.parse(decodeProto('0.0.121', bytes));
    expect(review.nameValue[0].name).toBe('b');
    expect(review.originalBytesHex).toBe(Buffer.from(bytes).toString('hex'));
  });

  describe.each(['0.0.101', '0.0.102'] as const)('%s certificate hash input', fileId => {
    test.each(['0xffZZ', '0xf', '0x123', '0xgg', '0xff\n', '0xff ff'])(
      'rejects malformed hexadecimal %j',
      nodeCertHash => {
        const content = JSONtoUInt8Array({ nodeAddress: [{ nodeCertHash }] });
        expect(() => encodeHederaSpecialFile(content, fileId)).toThrow('nodeCertHash must contain');
      },
    );

    test.each([
      ['0x', []],
      ['0xff00', [255, 0]],
      ['0xAbCD', [171, 205]],
      ['legacy text', Array.from(new TextEncoder().encode('legacy text'))],
    ] as const)('preserves bytes for %j', (nodeCertHash, expected) => {
      const content = JSONtoUInt8Array({ nodeAddress: [{ nodeCertHash }] });
      const bytes = encodeHederaSpecialFile(content, fileId);
      const decoded = proto.NodeAddressBook.decode(bytes);
      expect(Array.from(decoded.nodeAddress[0].nodeCertHash ?? [])).toEqual(expected);
    });
  });

  describe.each(['0.0.121', '0.0.122'] as const)('%s settings data input', fileId => {
    test.each(['!!!!', '/w', '/w=', '/w===', '/w==junk', '/w==\n', '_w==', '/x==', 123, null])(
      'rejects malformed base64 %j',
      data => {
        const content = JSONtoUInt8Array({ nameValue: [{ name: 'key', value: 'value', data }] });
        expect(() => encodeHederaSpecialFile(content, fileId)).toThrow(
          'Setting.data must be a standard padded base64 string',
        );
      },
    );

    test.each([
      ['', []],
      ['/w==', [255]],
      ['/wA=', [255, 0]],
      ['/wAB', [255, 0, 1]],
      [undefined, []],
    ] as const)('preserves bytes for %j', (data, expected) => {
      const content = JSONtoUInt8Array({ nameValue: [{ name: 'key', value: 'value', data }] });
      const bytes = encodeHederaSpecialFile(content, fileId);
      const decoded = proto.ServicesConfigurationList.decode(bytes);
      expect(Array.from(decoded.nameValue[0].data ?? [])).toEqual(expected);
    });
  });

  test('review JSON can be re-encoded for configuration and address-book validation', () => {
    for (const fileId of ['0.0.121', '0.0.101'] as const) {
      const bytes =
        fileId === '0.0.121'
          ? proto.ServicesConfigurationList.encode({
              nameValue: [{ name: 'a=b', value: 'x\nfoo=bar', data: Uint8Array.of(255) }],
            }).finish()
          : proto.NodeAddressBook.encode({
              nodeAddress: [{ nodeCertHash: Uint8Array.of(255) }],
            }).finish();
      const review = decodeProto(fileId, bytes);
      const encoded = encodeHederaSpecialFile(JSONtoUInt8Array(review), fileId);
      // The address-book encoder writes an explicit `stake: 0`, which the hidden-data notice flags.
      const before = JSON.parse(withoutReviewMetadata(review));
      const after = JSON.parse(withoutReviewMetadata(decodeProto(fileId, encoded)));
      // Re-encoding may explicitly write default fields; validation must retain all values.
      expect(after).toEqual(before);
    }
  });

  test('isHederaSpecialFileId: validates that a file is special', () => {
    const fileId = new FileId(101);

    const flag = isHederaSpecialFileId(fileId.toString());

    expect(flag).toBe(true);
  });

  test('decodeProto: decodes special files', () => {
    /* File 101 */
    const file_101 = new FileId(101);

    const decoded_101 = decodeProto(
      file_101.toString() as HederaSpecialFileId,
      Uint8Array.from(buffer101),
    );

    expect(decoded_101).toBe(expectedReview(string101, 101, buffer101));
    expect(JSON.parse(decoded_101)).not.toHaveProperty('warning');

    /* File 102 */
    const file_102 = new FileId(102);

    const decoded_102 = decodeProto(
      file_102.toString() as HederaSpecialFileId,
      Uint8Array.from(buffer102),
    );

    expect(decoded_102).toBe(expectedReview(string102, 102, buffer102));

    /* File 111 */
    const file_111 = new FileId(111);

    const decoded_111 = decodeProto(
      file_111.toString() as HederaSpecialFileId,
      Uint8Array.from(buffer111),
    );

    expect(decoded_111).toBe(expectedReview(string111, 111, buffer111));

    /* File 112 */
    const file_112 = new FileId(112);

    const decoded_112 = decodeProto(
      file_112.toString() as HederaSpecialFileId,
      Uint8Array.from(buffer112),
    );

    expect(decoded_112).toBe(expectedReview(string112, 112, buffer112));

    /* File 121 */
    const file_121 = new FileId(121);

    const decoded_121 = decodeProto(
      file_121.toString() as HederaSpecialFileId,
      Uint8Array.from(buffer121),
    );

    expect(decoded_121).toBe(expectedReview(string121, 121, buffer121));

    /* File 122 */
    const file_122 = new FileId(122);

    const decoded_122 = decodeProto(
      file_122.toString() as HederaSpecialFileId,
      Uint8Array.from(buffer122),
    );

    expect(decoded_122).toBe(expectedReview(string122, 122, buffer122));

    /* File 123 */
    const file_123 = new FileId(123);

    const decoded_123 = decodeProto(
      file_123.toString() as HederaSpecialFileId,
      Uint8Array.from(buffer123),
    );

    expect(decoded_123).toBe(expectedReview(string123, 123, buffer123));
  });

  test('decodeProto: simply string returned on non-special file provided', () => {
    const decoded = decodeProto('*' as HederaSpecialFileId, accountId.toBytes());

    expect(JSON.parse(decoded)).toEqual({
      ...JSON.parse(nonFormattedDecodeSpecialFile),
      originalBytesHex: Buffer.from(accountId.toBytes()).toString('hex'),
    });
  });

  test('decodeProto: returns undefined if id of non-special file is provided', () => {
    const fileId = new FileId(13123);

    expect(() =>
      decodeProto(fileId.toString() as HederaSpecialFileId, Uint8Array.from([])),
    ).toThrowError('File ID is not Hedera special file');
  });

  test('encodeHederaSpecialFile: encodes every type of special file', () => {
    /* File 101 */
    const fileId_101 = new FileId(101);
    const content_101 = JSONtoUInt8Array(protoInput101);

    const encoded_101 = encodeHederaSpecialFile(
      content_101,
      fileId_101.toString() as HederaSpecialFileId,
    );

    expect(decodeProto(fileId_101.toString() as HederaSpecialFileId, encoded_101)).toBe(
      expectedReview(string101, 101, encoded_101),
    );

    /* File 102 */
    const fileId_102 = new FileId(102);
    const content_102 = JSONtoUInt8Array(protoInput102);

    const encoded_102 = encodeHederaSpecialFile(
      content_102,
      fileId_102.toString() as HederaSpecialFileId,
    );

    expect(decodeProto(fileId_102.toString() as HederaSpecialFileId, encoded_102)).toBe(
      expectedReview(string102, 102, encoded_102),
    );

    /* File 111 */
    const fileId_111 = new FileId(111);
    const content_111 = JSONtoUInt8Array(protoInput111);

    const encoded_111 = encodeHederaSpecialFile(
      content_111,
      fileId_111.toString() as HederaSpecialFileId,
    );

    expect(decodeProto(fileId_111.toString() as HederaSpecialFileId, encoded_111)).toBe(
      expectedReview(string111, 111, encoded_111),
    );

    /* File 112 */
    const fileId_112 = new FileId(112);
    const content_112 = JSONtoUInt8Array(protoInput112);

    const encoded_112 = encodeHederaSpecialFile(
      content_112,
      fileId_112.toString() as HederaSpecialFileId,
    );

    expect(decodeProto(fileId_112.toString() as HederaSpecialFileId, encoded_112)).toBe(
      expectedReview(string112, 112, encoded_112),
    );

    /* File 121 */
    const fileId_121 = new FileId(121);
    const content_121 = JSONtoUInt8Array(protoInput121);

    const encoded_121 = encodeHederaSpecialFile(
      content_121,
      fileId_121.toString() as HederaSpecialFileId,
    );

    expect(decodeProto(fileId_121.toString() as HederaSpecialFileId, encoded_121)).toBe(
      expectedReview(string121, 121, encoded_121),
    );

    /* File 122 */
    const fileId_122 = new FileId(122);
    const content_122 = JSONtoUInt8Array(protoInput122);

    const encoded_122 = encodeHederaSpecialFile(
      content_122,
      fileId_122.toString() as HederaSpecialFileId,
    );

    expect(decodeProto(fileId_122.toString() as HederaSpecialFileId, encoded_122)).toBe(
      expectedReview(string122, 122, encoded_122),
    );

    /* File 123 */
    const fileId_123 = new FileId(123);
    const content_123 = JSONtoUInt8Array(protoInput123);

    const encoded_123 = encodeHederaSpecialFile(
      content_123,
      fileId_123.toString() as HederaSpecialFileId,
    );

    expect(decodeProto(fileId_123.toString() as HederaSpecialFileId, encoded_123)).toBe(
      expectedReview(string123, 123, encoded_123),
    );
  });

  test('encodeHederaSpecialFile: throws if file is not special', () => {
    const fileId = new FileId(10123);

    expect(() =>
      encodeHederaSpecialFile(Uint8Array.from([]), fileId.toString() as HederaSpecialFileId),
    ).toThrowError('File is not special');
  });
});
