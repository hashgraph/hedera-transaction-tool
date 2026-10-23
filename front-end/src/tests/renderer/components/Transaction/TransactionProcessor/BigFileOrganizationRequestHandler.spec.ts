// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import {
  AccountId,
  FileId,
  FileUpdateTransaction,
  Hbar,
  KeyList,
  PrivateKey,
  Timestamp,
  Transaction,
  TransactionId,
} from '@hiero-ledger/sdk';

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

vi.mock('@renderer/services/keyPairService', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/services/keyPairService')>()),
  decryptPrivateKey: vi.fn().mockResolvedValue('priv-key-raw'),
}));

vi.mock('@renderer/services/organization', () => ({
  addObservers: vi.fn().mockResolvedValue(undefined),
  addApprovers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@renderer/services/organization/transactionGroup', () => ({
  submitTransactionGroup: vi.fn(),
  getTransactionGroupById: vi.fn().mockResolvedValue({ groupItems: [] }),
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

import BigFileOrganizationRequestHandler from '@renderer/components/Transaction/TransactionProcessor/components/BigFileOrganizationRequestHandler.vue';
import { TransactionRequest } from '@renderer/components/Transaction/TransactionProcessor';
import { submitTransactionGroup } from '@renderer/services/organization/transactionGroup';

// Real frozen bytes, so the handler can parse them like it would the main process output
const freezeBytes = async (bytes: Uint8Array) =>
  Transaction.fromBytes(bytes)
    .setNodeAccountIds([AccountId.fromString('0.0.3')])
    .freeze()
    .toBytes();

const submitGroupMock = vi.mocked(submitTransactionGroup);

function buildRequest() {
  const key = PrivateKey.generateED25519().publicKey;
  const transaction = new FileUpdateTransaction()
    .setFileId(FileId.fromString('0.0.150'))
    .setContents(new Uint8Array(20_000).fill(1))
    .setTransactionId(
      TransactionId.withValidStart(
        AccountId.fromString('0.0.1000'),
        Timestamp.fromDate(new Date()),
      ),
    )
    .setMaxTransactionFee(new Hbar(2));

  return TransactionRequest.fromData({
    transactionKey: new KeyList([key]),
    transactionBytes: transaction.toBytes(),
    name: 'big',
    description: '',
    submitManually: false,
    reminderMillisecondsBefore: null,
  });
}

describe('BigFileOrganizationRequestHandler.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    submitGroupMock.mockReset().mockResolvedValue({ id: 3 } as never);
    mocks.sign.mockReset().mockImplementation((bytes: Uint8Array) => new Uint8Array([bytes[0]]));
    mocks.freeze.mockReset().mockImplementation(freezeBytes);
  });

  test('freezes the update and append items, signs the frozen bytes and submits those same bytes', async () => {
    const wrapper = mount(BigFileOrganizationRequestHandler, {
      props: { observers: [], approvers: [] },
    });
    await (wrapper.vm as unknown as { handle: (r: unknown) => Promise<void> }).handle(
      buildRequest(),
    );

    expect(mocks.freeze).toHaveBeenCalledTimes(2);
    expect(mocks.sign).toHaveBeenCalledTimes(2);

    const items = submitGroupMock.mock.calls[0][4];
    expect(items).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      const frozen = (await mocks.freeze.mock.results[i].value) as Uint8Array;
      expect(mocks.sign.mock.calls[i][0]).toEqual(frozen);
      expect(items[i].transaction.transactionBytes).toBe(Array.from(frozen).join(','));
      expect(items[i].transaction.creatorKeyId).toBe(42);
    }
    expect(wrapper.emitted('transaction:group:submit:success')).toEqual([[3]]);
  });

  test('does not submit when freezing fails', async () => {
    const err = new Error('freeze failed');
    mocks.freeze.mockRejectedValue(err);

    const wrapper = mount(BigFileOrganizationRequestHandler, {
      props: { observers: [], approvers: [] },
    });
    await expect(
      (wrapper.vm as unknown as { handle: (r: unknown) => Promise<void> }).handle(buildRequest()),
    ).rejects.toBe(err);

    expect(mocks.sign).not.toHaveBeenCalled();
    expect(submitGroupMock).not.toHaveBeenCalled();
  });
});
