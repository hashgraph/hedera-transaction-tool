// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import {
  AccountId,
  FileId,
  FileAppendTransaction,
  Hbar,
  PrivateKey,
  Timestamp,
  Transaction,
  TransactionId,
} from '@hiero-ledger/sdk';

const mocks = vi.hoisted(() => ({
  sign: vi.fn(),
  freeze: vi.fn(),
  submitGroup: vi.fn(),
}));

vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: vi.fn(() => ({
    getPassword: vi.fn(() => 'password'),
    passwordModalOpened: vi.fn(() => false),
  })),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: vi.fn(() => ({ error: vi.fn(), success: vi.fn() })) },
}));

vi.mock('@renderer/services/keyPairService', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/services/keyPairService')>()),
  decryptPrivateKey: vi.fn().mockResolvedValue('priv-key-raw'),
}));

vi.mock('@renderer/services/transactionService', () => ({
  freeze: mocks.freeze,
  execute: vi.fn(),
  signTransaction: vi.fn(),
  storeTransaction: vi.fn(),
}));

vi.mock('@renderer/services/transactionDraftsService', () => ({ deleteDraft: vi.fn() }));
vi.mock('@renderer/services/transactionGroupsService', () => ({
  addGroup: vi.fn(),
  addGroupItem: vi.fn(),
  editGroupItem: vi.fn(),
  getGroupItem: vi.fn(),
}));

vi.mock('@renderer/services/organization', () => ({
  addApprovers: vi.fn(),
  addObservers: vi.fn(),
  submitTransactionGroup: mocks.submitGroup,
  getTransactionGroupById: vi.fn().mockResolvedValue({ groupItems: [] }),
}));

vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  assertUserLoggedIn: vi.fn(),
  isUserLoggedIn: vi.fn(() => true),
  isLoggedInOrganization: vi.fn(() => true),
  ableToSign: vi.fn(() => true),
  getPrivateKey: vi.fn(() => ({ sign: mocks.sign })),
  uint8ToHex: vi.fn((bytes: Uint8Array) => Array.from(bytes).join(',')),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({
    selectedOrganization: {
      serverUrl: 'https://org.test',
      userKeys: [{ publicKey: 'pubkey-1', id: 42 }],
    },
    keyPairs: [{ public_key: 'pubkey-1' }],
    personal: { id: 'user-1', useKeychain: false },
    publicKeys: ['pubkey-1'],
    refetchKeys: vi.fn(),
  })),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({ network: 'testnet' })),
}));

import TransactionGroupProcessor from '@renderer/components/Transaction/TransactionGroupProcessor.vue';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

const freezeBytes = async (bytes: Uint8Array) =>
  Transaction.fromBytes(bytes)
    .setNodeAccountIds([AccountId.fromString('0.0.3')])
    .freeze()
    .toBytes();

function buildItem(seq: number) {
  const validStart = new Date('2030-01-01T00:00:00Z');
  const bytes = new FileAppendTransaction()
    .setFileId(FileId.fromString('0.0.150'))
    .setContents(new Uint8Array([1, 2, 3]))
    .setTransactionId(
      TransactionId.withValidStart(
        AccountId.fromString('0.0.1000'),
        Timestamp.fromDate(validStart),
      ),
    )
    .setMaxTransactionFee(new Hbar(2))
    .toBytes();
  return {
    seq: String(seq),
    transactionBytes: bytes,
    type: 'File Append Transaction',
    description: '',
    keyList: [],
    observers: [],
    approvers: [],
    payerAccountId: '0.0.1000',
    validStart,
  };
}

const stubs = {
  AppModal: { template: '<div><slot name="header" /><slot /><slot name="footer" /></div>' },
};

describe('TransactionGroupProcessor.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.submitGroup.mockReset().mockResolvedValue({ id: 8, transactionBytes: 'b' });
    mocks.sign.mockReset().mockImplementation((bytes: Uint8Array) => new Uint8Array([bytes[0]]));
    mocks.freeze.mockReset().mockImplementation(freezeBytes);
  });

  async function confirm() {
    const store = useTransactionGroupStore();
    store.$patch({ groupItems: [buildItem(0), buildItem(1)] } as never);

    const onSubmitted = vi.fn();
    const wrapper = mount(TransactionGroupProcessor, {
      props: { onSubmitted },
      global: { stubs, config: { errorHandler: () => {} } },
    });
    await (wrapper.vm as unknown as { process: (k: unknown) => Promise<void> }).process(
      PrivateKey.generateED25519().publicKey,
    );
    await flushPromises();
    await wrapper.get('[data-testid="button-confirm-group-transaction"]').trigger('click');
    await flushPromises();
    return { onSubmitted };
  }

  test('freezes every item, signs the frozen bytes and submits those same bytes', async () => {
    const { onSubmitted } = await confirm();

    expect(mocks.freeze).toHaveBeenCalledTimes(2);
    expect(mocks.sign).toHaveBeenCalledTimes(2);

    const items = mocks.submitGroup.mock.calls[0][4];
    expect(items).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      const frozen = (await mocks.freeze.mock.results[i].value) as Uint8Array;
      expect(mocks.sign.mock.calls[i][0]).toEqual(frozen);
      expect(items[i].transaction.transactionBytes).toBe(Array.from(frozen).join(','));
      expect(items[i].transaction.signature).toBe(String(frozen[0]));
    }
    expect(onSubmitted).toHaveBeenCalledWith(8, 'b');
  });

  test('does not submit when freezing fails', async () => {
    mocks.freeze.mockRejectedValue(new Error('freeze failed'));
    const { onSubmitted } = await confirm();

    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.submitGroup).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
  });
});
