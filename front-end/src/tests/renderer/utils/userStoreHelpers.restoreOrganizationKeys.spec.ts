// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PrivateKey } from '@hiero-ledger/sdk';

import { restoreOrganizationKeys } from '@renderer/utils/userStoreHelpers';
import { restorePrivateKey } from '@renderer/services/keyPairService';
import { compareDataToHashes } from '@renderer/services/electronUtilsService';

vi.mock('@renderer/services/keyPairService', () => ({
  restorePrivateKey: vi.fn(),
  getKeyPairs: vi.fn(),
  storeKeyPair: vi.fn(),
}));
vi.mock('@renderer/services/electronUtilsService', () => ({
  hashData: vi.fn(),
  compareHash: vi.fn(),
  compareDataToHashes: vi.fn(),
}));
vi.mock('@renderer/services/organization', () => ({ getUserState: vi.fn(), uploadKey: vi.fn() }));
vi.mock('@renderer/services/organizationCredentials');
vi.mock('@renderer/services/organizationsService');
vi.mock('@renderer/services/mnemonicService');
vi.mock('@renderer/services/publicKeyMappingService');

const personalUser = { isLoggedIn: true, id: 'user-1', email: 'a@b.c', password: 'pw' } as never;
const recoveryPhrase = { words: ['w1', 'w2'], hash: 'phrase-hash', mnemonic: {} } as never;

const ed25519 = PrivateKey.generateED25519();
const ecdsa = PrivateKey.generateECDSA();

const userKey = (key: PrivateKey, index: number) => ({
  id: index + 1,
  userId: 1,
  publicKey: key.publicKey.toStringRaw(),
  index,
  mnemonicHash: 'stored-hash',
});

const organization = (userKeys: unknown[]) =>
  ({ id: 'org-1', userId: 1, isServerActive: true, loginRequired: false, userKeys }) as never;

describe('restoreOrganizationKeys - key type', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // The recovery phrase belongs to the uploaded keys' hash
    vi.mocked(compareDataToHashes).mockResolvedValue('stored-hash');
  });

  test('re-derives an ECDSA organization key as ECDSA', async () => {
    vi.mocked(restorePrivateKey).mockResolvedValue(ecdsa);

    const { keys, failedRestoreMessages } = await restoreOrganizationKeys(
      organization([userKey(ecdsa, 3)]),
      recoveryPhrase,
      personalUser,
      [],
      true,
    );

    expect(restorePrivateKey).toHaveBeenCalledWith(['w1', 'w2'], '', 3, 'ECDSA');
    expect(failedRestoreMessages).toEqual([]);
    expect(keys).toEqual([
      {
        publicKey: ecdsa.publicKey.toStringRaw(),
        privateKey: ecdsa.toStringRaw(),
        index: 3,
        mnemonicHash: 'stored-hash',
        encrypted: false,
        keyType: 'ECDSA',
      },
    ]);
  });

  test('re-derives an ED25519 organization key as ED25519', async () => {
    vi.mocked(restorePrivateKey).mockResolvedValue(ed25519);

    const { keys } = await restoreOrganizationKeys(
      organization([userKey(ed25519, 0)]),
      recoveryPhrase,
      personalUser,
      [],
      true,
    );

    expect(restorePrivateKey).toHaveBeenCalledWith(['w1', 'w2'], '', 0, 'ED25519');
    expect(keys).toHaveLength(1);
    expect(keys[0].keyType).toBe('ED25519');
  });

  test('picks the type per key when an organization has both types', async () => {
    vi.mocked(restorePrivateKey).mockImplementation(async (_words, _pass, _index, type) =>
      type === 'ECDSA' ? ecdsa : ed25519,
    );

    const { keys, failedRestoreMessages } = await restoreOrganizationKeys(
      organization([userKey(ed25519, 0), userKey(ecdsa, 1)]),
      recoveryPhrase,
      personalUser,
      [],
      true,
    );

    expect(vi.mocked(restorePrivateKey).mock.calls.map(c => [c[2], c[3]])).toEqual([
      [0, 'ED25519'],
      [1, 'ECDSA'],
    ]);
    expect(failedRestoreMessages).toEqual([]);
    expect(keys.map(k => k.index)).toEqual([0, 1]);
    expect(keys.map(k => k.keyType)).toEqual(['ED25519', 'ECDSA']);
  });

  test('reports a mismatch when the derived key is not the uploaded one', async () => {
    // An ECDSA key derived as ED25519 (the old behaviour) would not match the uploaded key
    vi.mocked(restorePrivateKey).mockResolvedValue(ed25519);

    const { keys, failedRestoreMessages } = await restoreOrganizationKeys(
      organization([userKey(ecdsa, 2)]),
      recoveryPhrase,
      personalUser,
      [],
      true,
    );

    expect(keys).toEqual([]);
    expect(failedRestoreMessages[0]).toContain('Public key mismatch');
  });

  test('skips keys that are already stored', async () => {
    const { keys } = await restoreOrganizationKeys(
      organization([userKey(ecdsa, 3)]),
      recoveryPhrase,
      personalUser,
      [{ public_key: ecdsa.publicKey.toStringRaw() }] as never,
      true,
    );

    expect(restorePrivateKey).not.toHaveBeenCalled();
    expect(keys).toEqual([]);
  });
});
