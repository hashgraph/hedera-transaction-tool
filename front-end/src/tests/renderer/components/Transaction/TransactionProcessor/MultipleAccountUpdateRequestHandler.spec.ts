// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { AccountId, Hbar, PrivateKey, Transaction } from '@hiero-ledger/sdk';

const mocks = vi.hoisted(() => ({
  sign: vi.fn(),
  freeze: vi.fn(),
}));

vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: vi.fn(() => ({
    getPassword: vi.fn(() => 'password'),
    passwordModalOpened: vi.fn(() => false),
  })),
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useRoute: vi.fn(() => ({ query: {}, params: {} })),
}));

vi.mock('@renderer/services/keyPairService', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/services/keyPairService')>()),
  decryptPrivateKey: vi.fn().mockResolvedValue('priv-key-raw'),
}));

vi.mock('@renderer/services/organization', () => ({
  submitTransactionGroup: vi.fn(),
  getTransactionGroupById: vi.fn().mockResolvedValue({ groupItems: [] }),
  addObservers: vi.fn().mockResolvedValue(undefined),
  addApprovers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@renderer/services/transactionService', () => ({ freeze: mocks.freeze }));

vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  assertIsLoggedInOrganization: vi.fn(),
  assertUserLoggedIn: vi.fn(),
  isLoggedInOrganization: vi.fn(() => true),
  uint8ToHex: vi.fn((bytes: Uint8Array) => Array.from(bytes).join(',')),
}));

vi.mock('@renderer/utils/sdk', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils/sdk')>()),
  getPrivateKey: vi.fn(() => ({ sign: mocks.sign })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({
    selectedOrganization: {
      serverUrl: 'https://org.test',
      userKeys: [{ publicKey: 'pubkey-1', id: 42 }],
    },
    keyPairs: [{ public_key: 'pubkey-1' }],
    personal: { id: 'user-1', useKeychain: false },
  })),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({ network: 'testnet' })),
}));

import MultipleAccountUpdateRequestHandler from '@renderer/components/Transaction/TransactionProcessor/components/MultipleAccountUpdateRequestHandler.vue';
import { MultipleAccountUpdateRequest } from '@renderer/components/Transaction/TransactionProcessor';
import { submitTransactionGroup } from '@renderer/services/organization';

// Real frozen bytes, so the handler can parse them like it would the main process output
const freezeBytes = async (bytes: Uint8Array) =>
  Transaction.fromBytes(bytes)
    .setNodeAccountIds([AccountId.fromString('0.0.3')])
    .freeze()
    .toBytes();

const submitGroupMock = vi.mocked(submitTransactionGroup);

function buildRequest() {
  return new MultipleAccountUpdateRequest({
    payerId: '0.0.2',
    baseValidStart: new Date('2030-01-01T00:00:00Z'),
    maxTransactionFee: new Hbar(2),
    accountIds: ['0.0.100', '0.0.101'],
    key: PrivateKey.generateED25519().publicKey,
    accountIsPayer: false,
    submitManually: false,
    reminderMillisecondsBefore: null,
  });
}

describe('MultipleAccountUpdateRequestHandler.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    submitGroupMock.mockReset().mockResolvedValue({ id: 5 } as never);
    mocks.sign.mockReset().mockImplementation((bytes: Uint8Array) => new Uint8Array([bytes[0]]));
    mocks.freeze.mockReset().mockImplementation(freezeBytes);
  });

  test('freezes every item, signs the frozen bytes and submits those same bytes', async () => {
    const wrapper = mount(MultipleAccountUpdateRequestHandler, {
      props: { observers: [], approvers: [] },
    });
    await (wrapper.vm as unknown as { handle: (r: unknown) => Promise<void> }).handle(
      buildRequest(),
    );

    expect(mocks.freeze).toHaveBeenCalledTimes(2);
    expect(mocks.sign).toHaveBeenCalledTimes(2);

    for (let i = 0; i < 2; i++) {
      const frozen = await mocks.freeze.mock.results[i].value;
      expect(mocks.sign.mock.calls[i][0]).toEqual(frozen);
    }

    const items = submitGroupMock.mock.calls[0][4];
    expect(items).toHaveLength(2);
    items.forEach((item, i) => {
      const signed = mocks.sign.mock.calls[i][0] as Uint8Array;
      expect(item.transaction.transactionBytes).toBe(Array.from(signed).join(','));
      expect(item.transaction.creatorKeyId).toBe(42);
    });
    expect(wrapper.emitted('transaction:group:submit:success')).toEqual([[5]]);
  });

  test('does not submit when freezing fails', async () => {
    const err = new Error('freeze failed');
    mocks.freeze.mockRejectedValue(err);

    const wrapper = mount(MultipleAccountUpdateRequestHandler, {
      props: { observers: [], approvers: [] },
    });
    await expect(
      (wrapper.vm as unknown as { handle: (r: unknown) => Promise<void> }).handle(buildRequest()),
    ).rejects.toBe(err);

    expect(mocks.sign).not.toHaveBeenCalled();
    expect(submitGroupMock).not.toHaveBeenCalled();
  });
});
