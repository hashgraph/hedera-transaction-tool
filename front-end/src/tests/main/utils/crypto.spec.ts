import { expect } from 'vitest';

import { decrypt, encrypt } from '@main/utils/crypto';

describe('Crypto utilities', () => {
  test('encrypt & decrypt: encrypts and decrypts text data correctly', () => {
    const text = 'my-private-key';
    const password = 'you-cannot-decrypt-it';

    const encrypted = encrypt(text, password);
    const decryped = decrypt(encrypted, password);

    expect(decryped).toEqual(text);
  });

  test('encrypt & decrypt: cannot decrypt with different password', () => {
    const text = 'my-private-key';
    const password = 'you-cannot-decrypt-it';
    const wrongPassword = 'you-can-decrypt-it';

    const encrypted = encrypt(text, password);

    expect(() => decrypt(encrypted, wrongPassword)).to.throw();
  });
});
