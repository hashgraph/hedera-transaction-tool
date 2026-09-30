// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { ContractId, DelegateContractId, KeyList, Long, PrivateKey } from '@hiero-ledger/sdk';
import { proto } from '@hiero-ledger/proto';
import { KeyType } from '@shared/interfaces/HederaSchema';

import { compareKeys, decodeKeyList, encodeKey } from '@renderer/utils/sdk';

import { parseNetworkResponseKey } from '@renderer/services/mirrorNodeDataService';

describe('contract account keys from mirror node responses', () => {
  test('preserves the contract key returned for mainnet account 0.0.10880916', () => {
    // Mirror node omits the zero-valued shard and realm of 0.0.10880916.
    const encoded = proto.Key.encode({
      contractID: { contractNum: Long.fromNumber(10880916) },
    }).finish();
    expect(Buffer.from(encoded).toString('hex')).toBe('0a0518948f9805');

    const key = parseNetworkResponseKey({
      _type: KeyType.ProtobufEncoded,
      key: '0a0518948f9805',
    });

    expect(key).toBeInstanceOf(ContractId);
    expect(key?.toString()).toBe('0.0.10880916');
  });

  test('preserves a delegatable contract key', () => {
    const encoded = proto.Key.encode({
      delegatableContractId: { contractNum: Long.fromNumber(10880916) },
    }).finish();
    expect(Buffer.from(encoded).toString('hex')).toBe('420518948f9805');

    const key = parseNetworkResponseKey({
      _type: KeyType.ProtobufEncoded,
      key: '420518948f9805',
    });

    expect(key).toBeInstanceOf(DelegateContractId);
    expect(key?.toString()).toBe('0.0.10880916');
  });
});

describe('mixed key serialization', () => {
  const contract = ContractId.fromString('0.0.10880916');
  const delegate = DelegateContractId.fromString('0.0.10880917');
  const publicKey = PrivateKey.generateED25519().publicKey;
  const nested = new KeyList([contract, new KeyList([delegate, publicKey], 1)]);

  test.each([contract, delegate, nested, new KeyList([nested, delegate], 1)])(
    'preserves all protobuf fields through mirror-node decoding',
    original => {
      const bytes = encodeKey(original);
      const decoded = parseNetworkResponseKey({
        _type: KeyType.ProtobufEncoded,
        key: Buffer.from(bytes).toString('hex'),
      });
      expect(decoded?._toProtobufKey()).toEqual(original._toProtobufKey());
      expect(encodeKey(decoded!)).toEqual(bytes);
    },
  );

  test('preserves nested contracts and thresholds in saved complex keys', () => {
    const bytes = encodeKey(nested);
    const decoded = decodeKeyList(Uint8Array.from(bytes).toString());
    expect(decoded._toProtobufKey()).toEqual(nested._toProtobufKey());
    expect(encodeKey(decoded)).toEqual(bytes);
  });
});


describe('contract key equality', () => {
  test('compares regular and delegatable contract keys by kind and ID', () => {
    const regular = ContractId.fromString('0.0.10880916');
    const sameRegular = ContractId.fromString('0.0.10880916');
    const delegatable = DelegateContractId.fromString('0.0.10880916');

    expect(compareKeys(regular, sameRegular)).toBe(true);
    expect(compareKeys(delegatable, DelegateContractId.fromString('0.0.10880916'))).toBe(true);
    expect(compareKeys(regular, delegatable)).toBe(false);
  });

  test('compares key lists containing contract keys independent of order', () => {
    const regular = ContractId.fromString('0.0.10880916');
    const delegatable = DelegateContractId.fromString('0.0.10880917');

    expect(compareKeys(new KeyList([regular, delegatable]), new KeyList([
      DelegateContractId.fromString('0.0.10880917'),
      ContractId.fromString('0.0.10880916'),
    ]))).toBe(true);
    expect(compareKeys(new KeyList([regular]), new KeyList([delegatable]))).toBe(false);
  });
});
