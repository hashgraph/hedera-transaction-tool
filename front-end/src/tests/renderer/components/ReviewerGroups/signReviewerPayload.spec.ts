import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ActionStatus } from '@renderer/components/ActionController/ActionReport';
import {
  resolveReviewerSigningKey,
  signReviewerPayload,
} from '@renderer/components/ReviewerGroups/signReviewerPayload';

const mocks = vi.hoisted(() => ({
  decryptPrivateKey: vi.fn(),
  getPrivateKey: vi.fn(),
  sign: vi.fn(),
}));

vi.mock('@renderer/services/keyPairService', () => ({
  decryptPrivateKey: mocks.decryptPrivateKey,
}));

vi.mock('@renderer/utils/sdk', () => ({
  getPrivateKey: mocks.getPrivateKey,
}));

vi.mock('@renderer/utils', () => ({
  // Reimplemented locally rather than importing the real @renderer/utils barrel, which
  // pulls in Pinia stores and IPC-backed services that aren't safe to load in this test.
  uint8ToHex: (uint8: Uint8Array) =>
    Array.from(uint8)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join(''),
}));

describe('resolveReviewerSigningKey', () => {
  test('returns an ActionReport when there are no local key pairs', () => {
    const result = resolveReviewerSigningKey([], [{ id: 1, userId: 1, publicKey: 'pk-1' }]);

    expect(result).toMatchObject({ status: ActionStatus.Error, title: 'No signing key available' });
  });

  test('returns an ActionReport when the local key has no matching organization key', () => {
    const result = resolveReviewerSigningKey(
      [{ public_key: 'local-only-key' } as never],
      [{ id: 1, userId: 1, publicKey: 'some-other-key' }],
    );

    expect(result).toMatchObject({ status: ActionStatus.Error, title: 'No signing key available' });
  });

  test('resolves the org key matching the FIRST local key pair, not just any matching one', () => {
    const result = resolveReviewerSigningKey(
      [{ public_key: 'key-a' } as never, { public_key: 'key-b' } as never],
      [
        { id: 2, userId: 1, publicKey: 'key-b' },
        { id: 1, userId: 1, publicKey: 'key-a' },
      ],
    );

    // key-b matches an org key too, but keyPairs[0] ("key-a") must win.
    expect(result).toEqual({ orgKeyId: 1, orgKeyPublicKey: 'key-a' });
  });
});

describe('signReviewerPayload', () => {
  beforeEach(() => {
    mocks.decryptPrivateKey.mockReset();
    mocks.getPrivateKey.mockReset();
    mocks.sign.mockReset();
    mocks.decryptPrivateKey.mockResolvedValue('decrypted-raw-key');
    mocks.sign.mockReturnValue(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    mocks.getPrivateKey.mockReturnValue({ sign: mocks.sign });
  });

  test('decrypts the local key, signs the canonical JSON payload, and returns the hex signature', async () => {
    const payload = { name: 'Treasury', threshold: 2 };

    const result = await signReviewerPayload('user-1', 'my-password', 5, 'org-public-key', payload);

    expect(mocks.decryptPrivateKey).toHaveBeenCalledWith('user-1', 'my-password', 'org-public-key');
    expect(mocks.getPrivateKey).toHaveBeenCalledWith('org-public-key', 'decrypted-raw-key');
    expect(mocks.sign).toHaveBeenCalledWith(new TextEncoder().encode(JSON.stringify(payload)));
    expect(result).toEqual({ userKeyId: 5, userSignature: 'deadbeef' });
  });
});
