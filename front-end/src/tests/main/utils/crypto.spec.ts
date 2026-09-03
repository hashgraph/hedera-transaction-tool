import { expect } from 'vitest';
import * as bcrypt from 'bcrypt';
import nodeCrypto from 'crypto';

import {
  decrypt,
  encrypt,
  hash,
  verifyHash,
  dualCompareHash,
  isLegacyBlob,
  PBKDF2_ITERATIONS,
  isClearTextToken,
} from '@main/utils/crypto';

describe('Crypto utilities', () => {
  test('PBKDF2_ITERATIONS meets OWASP minimum of 600,000', () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  test('encrypt: new blobs carry the v2 version prefix', async () => {
    const encrypted = await encrypt('key-data', 'password');
    expect(encrypted.startsWith('v2:')).toBe(true);
    expect(isLegacyBlob(encrypted)).toBe(false);
  });

  test('decrypt: handles legacy blobs encrypted with 2560 iterations', async () => {
    const password = 'test-password';
    const plaintext = 'my-private-key';

    const salt = nodeCrypto.randomBytes(64);
    const iv = nodeCrypto.randomBytes(16);
    const legacyKey = nodeCrypto.pbkdf2Sync(password, salt, 2560, 32, 'sha512');
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', legacyKey, iv);
    const encryptedBuf = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const legacyBlob = Buffer.concat([salt, iv, tag, encryptedBuf]).toString('base64');

    expect(isLegacyBlob(legacyBlob)).toBe(true);
    expect(await decrypt(legacyBlob, password)).toEqual(plaintext);
  });

  test('isClearTextToken() detects clear tokens', async () => {
    const password = 'test-password';
    const clearTextToken = "a.b.c";
    const encryptedToken = await encrypt(clearTextToken, password);

    expect(isClearTextToken(clearTextToken)).toBe(true);
    expect(isClearTextToken(encryptedToken)).toBe(false);
  });

  test('encrypt & decrypt: encrypts and decrypts text data correctly', async () => {
    const text = 'my-private-key';
    const password = 'you-cannot-decrypt-it';

    const encrypted = await encrypt(text, password);
    const decrypted = await decrypt(encrypted, password);

    expect(decrypted).toEqual(text);
  });

  test('encrypt & decrypt: cannot decrypt with different password', async () => {
    const text = 'my-private-key';
    const password = 'you-cannot-decrypt-it';
    const wrongPassword = 'you-can-decrypt-it';

    const encrypted = await encrypt(text, password);

    await expect(decrypt(encrypted, wrongPassword)).rejects.toThrow();
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
