// @vitest-environment node
import { describe, test, expect } from 'vitest';
import { ContractId, DelegateContractId, Key, KeyList, PrivateKey } from '@hiero-ledger/sdk';
import {
  detectPrivateKeyType,
  flattenKeyList,
  generateRandomKeyPair,
} from '@renderer/services/keyPairService';

describe('keyPairService.flattenKeyList - contract components', () => {
  const pk = PrivateKey.generateED25519().publicKey;

  test.each([ContractId, DelegateContractId])(
    'extracts only public keys from known components',
    Type => {
      const contract = Type.fromString('0.0.456');
      expect(flattenKeyList(contract)).toEqual([]);
      const key = new KeyList([pk, new KeyList([contract])], 1);
      expect(flattenKeyList(key).map(k => k.toStringRaw())).toEqual([pk.toStringRaw()]);
      expect(key.threshold).toBe(1);
      expect((key.toArray()[1] as KeyList).toArray()[0]).toBe(contract);
    },
  );

  test('rejects unknown standalone and nested components', () => {
    const unknown = {} as Key;
    for (const key of [unknown, new KeyList([pk, new KeyList([unknown])], 1)]) {
      expect(() => flattenKeyList(key)).toThrow('Unsupported key type');
    }
  });
});

describe('keyPairService.detectPrivateKeyType', () => {
  test('detects a DER-encoded ED25519 key', () => {
    expect(detectPrivateKeyType(PrivateKey.generateED25519().toStringDer())).toBe('ED25519');
  });

  test('detects a DER-encoded ECDSA key', () => {
    expect(detectPrivateKeyType(PrivateKey.generateECDSA().toStringDer())).toBe('ECDSA');
  });

  test('does not guess the type of a raw 32-byte key', () => {
    expect(detectPrivateKeyType(PrivateKey.generateED25519().toStringRaw())).toBeNull();
    expect(detectPrivateKeyType(PrivateKey.generateECDSA().toStringRaw())).toBeNull();
  });

  test('returns null for empty or non-hex input', () => {
    expect(detectPrivateKeyType('')).toBeNull();
    expect(detectPrivateKeyType('not a key')).toBeNull();
  });
});

describe('keyPairService.detectPrivateKeyType - input handling', () => {
  test('ignores surrounding whitespace and a 0x prefix', () => {
    const der = PrivateKey.generateECDSA().toStringDer();

    expect(detectPrivateKeyType(`  ${der}\n`)).toBe('ECDSA');
    expect(detectPrivateKeyType(`0x${der}`)).toBe('ECDSA');
  });

  test('accepts upper case hex', () => {
    expect(detectPrivateKeyType(PrivateKey.generateED25519().toStringDer().toUpperCase())).toBe(
      'ED25519',
    );
  });

  // The SDK parses these as an ECDSA key (it falls back to the last 32 bytes), which would
  // import a different key than the one the user pasted.
  test.each([
    ['48 bytes of garbage', 'ab'.repeat(48)],
    ['50 bytes of garbage', 'ab'.repeat(50)],
  ])('returns null for %s', (_label, input) => {
    expect(detectPrivateKeyType(input)).toBeNull();
  });

  test('returns null for an ED25519 DER key with a corrupted prefix', () => {
    const corrupted = PrivateKey.generateED25519().toStringDer().replace(/^302e/, '302f');

    expect(detectPrivateKeyType(corrupted)).toBeNull();
  });

  test('returns null for a truncated or extended DER key', () => {
    const der = PrivateKey.generateED25519().toStringDer();

    expect(detectPrivateKeyType(der.slice(0, -2))).toBeNull();
    expect(detectPrivateKeyType(`${der}00`)).toBeNull();
  });
});

describe('keyPairService.generateRandomKeyPair', () => {
  test('generates an ED25519 key pair whose public key matches the private key', () => {
    const keyPair = generateRandomKeyPair('ED25519', 'my key');

    expect(PrivateKey.fromStringED25519(keyPair.private_key).publicKey.toStringRaw()).toBe(
      keyPair.public_key,
    );
    expect(keyPair).toMatchObject({ nickname: 'my key', index: -1 });
  });

  test('generates an ECDSA key pair whose public key matches the private key', () => {
    const keyPair = generateRandomKeyPair('ECDSA', '');

    expect(PrivateKey.fromStringECDSA(keyPair.private_key).publicKey.toStringRaw()).toBe(
      keyPair.public_key,
    );
  });

  test('stores an empty nickname as null', () => {
    expect(generateRandomKeyPair('ED25519', '').nickname).toBeNull();
  });

  test('is not derived from a recovery phrase (index -1)', () => {
    expect(generateRandomKeyPair('ECDSA', 'x').index).toBe(-1);
  });

  test('generates a different key every time', () => {
    const a = generateRandomKeyPair('ED25519', '');
    const b = generateRandomKeyPair('ED25519', '');

    expect(a.private_key).not.toBe(b.private_key);
    expect(a.public_key).not.toBe(b.public_key);
  });

  test('generated ED25519 and ECDSA keys are detected as such once DER encoded', () => {
    const ed = PrivateKey.fromStringED25519(generateRandomKeyPair('ED25519', '').private_key);
    const ecdsa = PrivateKey.fromStringECDSA(generateRandomKeyPair('ECDSA', '').private_key);

    expect(detectPrivateKeyType(ed.toStringDer())).toBe('ED25519');
    expect(detectPrivateKeyType(ecdsa.toStringDer())).toBe('ECDSA');
  });
});
