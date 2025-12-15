import { KeyList, PublicKey } from '@hashgraph/sdk';

import { areKeysEqual, computeShortenedPublicKeyList } from '.';

jest.mock('@app/common/utils');

describe('computeShortenedPublicKeyList', () => {
  let publicKey1,
    publicKey2,
    publicKey3,
    publicKey4,
    publicKey5,
    publicKey6,
    publicKey7,
    publicKey8,
    publicKey9,
    publicKey10;
  let nestedKeyList1, nestedKeyList2, nestedKeyList3, keyList;

  beforeEach(() => {
    // Arrange
    publicKey1 = PublicKey.fromString(
      '88defdd627af7e31a426fd1e2fb002a5a1c1d3867470f8780bffd3cde341dd7b',
    );
    publicKey2 = PublicKey.fromString(
      '8def969ba1fd9d0a35ee05c50b5c457289be2da03349cf85525e1d27313a2fe5',
    );
    publicKey3 = PublicKey.fromString(
      'ac7ef83748ff29bb7b38b4371cba009569ae14a0c07b0a03322e9bb889c2001b',
    );
    publicKey4 = PublicKey.fromString(
      '28e33ec2d03112ef622c6cb4eb3b64bb6d8f3456c2789a6432d5914ff65b348b',
    );
    publicKey5 = PublicKey.fromString(
      '306ae720394ab634a25edb3aac7f3edb7a69c68b93dcd622624627e65b268965',
    );
    publicKey6 = PublicKey.fromString(
      '6da4f02864695f91ed71013268aa51af10b61331d157f6a7d292d39afd7062f9',
    );
    publicKey7 = PublicKey.fromString(
      'da2d595b2d4529d3dd83f5f414f2c973502078950f11e137ae922bada6d25eb5',
    );
    publicKey8 = PublicKey.fromString(
      '56db22d604963e20a89030392905d25a00d853e3a6aa3885ba86c8879d6b72c9',
    );
    publicKey9 = PublicKey.fromString(
      '2b633e211fbb485f9641cf33feb5e41775c49d426e038ac53a139786f1a3f986',
    );
    publicKey10 = PublicKey.fromString(
      'e495e50c5f81e3c5947d9093aec82c7ed1f02074b08f12e35f7d2d3cfa2906b2',
    );

    nestedKeyList1 = new KeyList([publicKey4, publicKey5, publicKey6]);
    nestedKeyList2 = new KeyList([publicKey7, publicKey8, nestedKeyList1]);
    nestedKeyList3 = new KeyList([publicKey9, publicKey10, nestedKeyList2]);
    keyList = new KeyList([publicKey1, publicKey2, publicKey3, nestedKeyList3]);
    keyList.setThreshold(3);
    nestedKeyList1.setThreshold(2);
    nestedKeyList2.setThreshold(1);
    nestedKeyList3.setThreshold(3);
  });

  it('should return null when not enough valid signatures are found', () => {
    const publicKeys = [
      publicKey1.toStringRaw(),
      publicKey9.toStringRaw(),
      publicKey4.toStringRaw(),
      publicKey5.toStringRaw(),
      publicKey6.toStringRaw(),
    ];

    // Act
    const result = computeShortenedPublicKeyList(new Set(publicKeys), keyList);

    // Assert
    expect(result).toBeNull();
  });

  it('should return a list of 6 public keys when enough valid signatures are found', () => {
    const publicKeys2 = [
      publicKey1.toStringRaw(),
      publicKey2.toStringRaw(),
      publicKey9.toStringRaw(),
      publicKey10.toStringRaw(),
      publicKey4.toStringRaw(),
      publicKey5.toStringRaw(),
      publicKey6.toStringRaw(),
    ];

    // Act
    const result = computeShortenedPublicKeyList(new Set(publicKeys2), keyList);

    // Assert
    expect(result).toHaveLength(6);
    expect(result).toContainEqual(publicKey1);
    expect(result).toContainEqual(publicKey2);
    expect(result).toContainEqual(publicKey9);
    expect(result).toContainEqual(publicKey10);
    expect(result).toContainEqual(publicKey4);
    expect(result).toContainEqual(publicKey5);
  });

  it('should return a list of 5 public keys when enough valid signatures are found', () => {
    const publicKeys3 = [
      publicKey1.toStringRaw(),
      publicKey2.toStringRaw(),
      publicKey9.toStringRaw(),
      publicKey10.toStringRaw(),
      publicKey4.toStringRaw(),
      publicKey5.toStringRaw(),
      publicKey6.toStringRaw(),
      publicKey7.toStringRaw(),
    ];

    // Act
    const result = computeShortenedPublicKeyList(new Set(publicKeys3), keyList);

    // Assert
    expect(result).toHaveLength(5);
    expect(result).toContainEqual(publicKey1);
    expect(result).toContainEqual(publicKey2);
    expect(result).toContainEqual(publicKey9);
    expect(result).toContainEqual(publicKey10);
    expect(result).toContainEqual(publicKey7);
  });

  it('should return true if the two key lists are logically equivalent', () => {
    expect(areKeysEqual(keyList, keyList)).toBe(true);

    const _nestedKeyList1 = new KeyList([publicKey6, publicKey4, publicKey5]);
    const _nestedKeyList2 = new KeyList([publicKey8, _nestedKeyList1, publicKey7]);
    const _nestedKeyList3 = new KeyList([publicKey9, publicKey10, _nestedKeyList2]);
    const keyList2 = new KeyList([publicKey3, publicKey1, publicKey2, _nestedKeyList3]);
    keyList2.setThreshold(3);
    _nestedKeyList1.setThreshold(2);
    _nestedKeyList2.setThreshold(1);
    _nestedKeyList3.setThreshold(3);

    expect(areKeysEqual(keyList, keyList2)).toBe(true);
  });

  it('should return false if the two key lists are not logically equivalent', () => {
    expect(areKeysEqual(keyList, keyList)).toBe(true);

    const _nestedKeyList1 = new KeyList([publicKey6, publicKey4, publicKey5]);
    const _nestedKeyList2 = new KeyList([publicKey8, _nestedKeyList1, publicKey7]);
    const keyList2 = new KeyList([publicKey3, publicKey1, publicKey2]);
    keyList2.setThreshold(3);
    _nestedKeyList1.setThreshold(2);
    _nestedKeyList2.setThreshold(1);

    expect(areKeysEqual(keyList, keyList2)).toBe(false);
  });
});
