import { expect } from 'vitest';

import { decrypt, encrypt } from '@main/utils/crypto';

describe('Crypto utilities', () => {
  test('encrypt & decrypt: encrypts and decrypts text data correctly', () => {
    const text = 'my-private-key';
    const password = 'you-cannot-decrypt-it';

    const encrypted = encrypt(text, password);

    const decryped = decrypt(encrypted, password);
    console.log('decrtpted', decryped);

    expect(decryped).toEqual(text);
  });
});
