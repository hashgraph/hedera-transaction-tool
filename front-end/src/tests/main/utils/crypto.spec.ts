import { expect } from 'vitest';
import * as bcrypt from 'bcrypt';

import { decrypt, encrypt, hash, verifyHash, dualCompareHash } from '@main/utils/crypto';

describe('Crypto utilities', () => {
  test('encrypt & decrypt: encrypts and decrypts text data correctly', () => {
    const text = 'my-private-key';
    const password = 'you-cannot-decrypt-it';

    const encrypted = encrypt(text, password);
    const decrypted = decrypt(encrypted, password);

    expect(decrypted).toEqual(text);
  });

  test('encrypt & decrypt: cannot decrypt with different password', () => {
    const text = 'my-private-key';
    const password = 'you-cannot-decrypt-it';
    const wrongPassword = 'you-can-decrypt-it';

    const encrypted = encrypt(text, password);

    expect(() => decrypt(encrypted, wrongPassword)).to.throw();
  });

  test('hash: hashes data correctly', async () => {
    const data = 'my-data';
    const hashedData = await hash(data);

    expect(await verifyHash(hashedData, data)).toBe(true);
  });

  test('hash: hashes data with pseudo salt correctly', async () => {
    const data = 'my-data';
    const hashedData = await hash(data, true);

    expect(await verifyHash(hashedData, data)).toBe(true);
  });

  test('verifyHash: verifies correct hash', async () => {
    const data = 'my-data';
    const hashedData = await hash(data);

    expect(await verifyHash(hashedData, data)).toBe(true);
  });

  test('verifyHash: does not verify incorrect hash', async () => {
    const data = 'my-data';
    const wrongData = 'wrong-data';
    const hashedData = await hash(data);

    expect(await verifyHash(hashedData, wrongData)).toBe(false);
  });

  test('dualCompareHash: matches bcrypt hash correctly', async () => {
    const data = 'my-data';
    const bcryptHash = await bcrypt.hash(data, 10);

    const result = await dualCompareHash(data, bcryptHash);

    expect(result.correct).toBe(true);
    expect(result.isBcrypt).toBe(true);
  });

  test('dualCompareHash: matches argon2 hash correctly', async () => {
    const data = 'my-data';
    const argon2Hash = await hash(data);

    const result = await dualCompareHash(data, argon2Hash);

    expect(result.correct).toBe(true);
    expect(result.isBcrypt).toBe(false);
  });

  test('dualCompareHash: does not match incorrect hash', async () => {
    const data = 'my-data';
    const wrongHash = await hash('wrong-data');

    const result = await dualCompareHash(data, wrongHash);

    expect(result.correct).toBe(false);
  });
});
