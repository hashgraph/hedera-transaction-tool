import {expect} from 'vitest';

import {createCredentials, decrypt, encrypt, hash} from '@main/utils/crypto';

describe('Crypto utilities', () => {
  test('hash: Returns correct SHA256 Hash', () => {
    const password = 'testPassword';
    const passwordSHA256Hash = 'fd5cb51bafd60f6fdbedde6e62c473da6f247db271633e15919bab78a02ee9eb';

    const hashBuffer = hash(password);

    expect(hashBuffer.toString('hex')).toEqual(passwordSHA256Hash);
  });

  test('createCredentials: creates correct secret key and IV', () => {
    const password = 'testPassword';
    const passwordSHA256Hash = hash(password);

    const IVFromPassword = passwordSHA256Hash.slice(0, 16);
    const secretKeyFromPassword = hash(passwordSHA256Hash).slice(8);

    const [key, iv] = createCredentials(password);

    expect(key).toEqual(secretKeyFromPassword);
    expect(iv).toEqual(IVFromPassword);
  });

  test('encrypt & decrypt: encrypts and decrypts text data correctly', () => {
    const text = 'my-private-key';
    const password = 'you-cannot-decrypt-it';

    const encrypted = encrypt(text, password);

    const decryped = decrypt(encrypted, password);

    expect(decryped).toEqual(text);
  });
});
