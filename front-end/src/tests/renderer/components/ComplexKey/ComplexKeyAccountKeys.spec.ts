// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { Key, KeyList, PrivateKey, PublicKey } from '@hiero-ledger/sdk';

import ComplexKeyThreshold from '@renderer/components/ComplexKey/ComplexKeyThreshold.vue';

const mocks = vi.hoisted(() => ({
  userStore: { keyPairs: [] },
  contactsStore: { getContactByPublicKey: vi.fn(() => null) },
  toastManager: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: vi.fn(() => mocks.userStore) }));
vi.mock('@renderer/stores/storeContacts', () => ({ default: vi.fn(() => mocks.contactsStore) }));
vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: vi.fn(() => mocks.toastManager) },
}));

// Real isPublicKeyInKeyList is what we want here (duplicate detection), so keep utils real.
const globalStubs = {
  AppButton: { template: '<button><slot /></button>' },
  AppPublicKeyInput: { template: '<div />' },
  ComplexKeyAddPublicKeyModal: { template: '<div />' },
  // Exposes the callback the real modal receives so tests can simulate "Insert".
  ComplexKeySelectAccountModal: {
    name: 'ComplexKeySelectAccountModal',
    props: ['show', 'onSelectAccount'],
    template: '<div data-testid="select-account-modal" />',
  },
};

const newPk = () => PrivateKey.generateED25519().publicKey;

function mountRoot(keyList: KeyList) {
  return mount(ComplexKeyThreshold, {
    props: { keyList, onRemoveKeyList: vi.fn() },
    global: { stubs: globalStubs },
  });
}

async function openAccountModal(wrapper: VueWrapper, depth: string) {
  await wrapper
    .find(`[data-testid="button-complex-key-add-element-account-${depth}"]`)
    .trigger('click');
  await flushPromises();
}

async function insertAccountKey(wrapper: VueWrapper, key: Key) {
  const modal = wrapper.findComponent({ name: 'ComplexKeySelectAccountModal' });
  (modal.props('onSelectAccount') as (k: Key) => void)(key);
  await flushPromises();
}

const lastEmitted = (wrapper: VueWrapper) => {
  const events = wrapper.emitted('update:keyList')!;
  return events[events.length - 1][0] as KeyList;
};

describe('5.13.3 account-based keys at various depths', () => {
  beforeEach(() => vi.clearAllMocks());

  it('depth 0: adds an account public key to the root list', async () => {
    const pk = newPk();
    const wrapper = mountRoot(new KeyList([]));
    await openAccountModal(wrapper, '0');
    await insertAccountKey(wrapper, pk);

    const result = lastEmitted(wrapper);
    expect(result.toArray()).toHaveLength(1);
    expect((result.toArray()[0] as PublicKey).toStringRaw()).toBe(pk.toStringRaw());
  });

  it('closes the account modal after a successful insert', async () => {
    const wrapper = mountRoot(new KeyList([]));
    await openAccountModal(wrapper, '0');
    expect(wrapper.findComponent({ name: 'ComplexKeySelectAccountModal' }).exists()).toBe(true);
    await insertAccountKey(wrapper, newPk());
    expect(wrapper.findComponent({ name: 'ComplexKeySelectAccountModal' }).exists()).toBe(false);
  });

  it('depth 1: adds an account key inside a nested threshold, bubbling up to the root', async () => {
    const existing = newPk();
    const accountKey = newPk();
    const wrapper = mountRoot(new KeyList([existing, new KeyList([])]));

    await openAccountModal(wrapper, '0-1');
    await insertAccountKey(wrapper, accountKey);

    const result = lastEmitted(wrapper);
    const [first, nested] = result.toArray();
    expect((first as PublicKey).toStringRaw()).toBe(existing.toStringRaw());
    expect(nested).toBeInstanceOf(KeyList);
    expect(((nested as KeyList).toArray()[0] as PublicKey).toStringRaw()).toBe(
      accountKey.toStringRaw(),
    );
  });

  it('depth 2: adds an account key three levels deep and keeps parent thresholds', async () => {
    const accountKey = newPk();
    const leaf = new KeyList([]);
    const mid = new KeyList([leaf], 1);
    const root = new KeyList([mid, newPk()], 2);
    const wrapper = mountRoot(root);

    await openAccountModal(wrapper, '0-0-0');
    await insertAccountKey(wrapper, accountKey);

    const result = lastEmitted(wrapper);
    expect(result.threshold).toBe(2);
    const newMid = result.toArray()[0] as KeyList;
    expect(newMid.threshold).toBe(1);
    const newLeaf = newMid.toArray()[0] as KeyList;
    expect((newLeaf.toArray()[0] as PublicKey).toStringRaw()).toBe(accountKey.toStringRaw());
  });

  it('an account whose key is itself a key list is added as a nested list', async () => {
    const accountKeyList = new KeyList([newPk(), newPk()], 2);
    const wrapper = mountRoot(new KeyList([]));
    await openAccountModal(wrapper, '0');
    await insertAccountKey(wrapper, accountKeyList);

    const result = lastEmitted(wrapper);
    expect(result.toArray()).toHaveLength(1);
    const nested = result.toArray()[0] as KeyList;
    expect(nested).toBeInstanceOf(KeyList);
    expect(nested.threshold).toBe(2);
    expect(nested.toArray()).toHaveLength(2);
  });

  it('rejects an account key that duplicates a public key at the same level', async () => {
    const pk = newPk();
    const wrapper = mountRoot(new KeyList([pk]));
    await openAccountModal(wrapper, '0');
    await insertAccountKey(wrapper, pk);

    expect(mocks.toastManager.error).toHaveBeenCalledWith(
      'Public key already exists in the key list',
    );
    expect(wrapper.emitted('update:keyList')).toBeUndefined();
  });

  it('allows the same account key at a different level', async () => {
    const pk = newPk();
    const wrapper = mountRoot(new KeyList([pk, new KeyList([])]));
    await openAccountModal(wrapper, '0-1');
    await insertAccountKey(wrapper, pk);

    expect(mocks.toastManager.error).not.toHaveBeenCalled();
    const nested = lastEmitted(wrapper).toArray()[1] as KeyList;
    expect(nested.toArray()).toHaveLength(1);
  });

  it('preserves the existing threshold when adding an account key', async () => {
    const wrapper = mountRoot(new KeyList([newPk(), newPk(), newPk()], 2));
    await openAccountModal(wrapper, '0');
    await insertAccountKey(wrapper, newPk());

    const result = lastEmitted(wrapper);
    expect(result.toArray()).toHaveLength(4);
    expect(result.threshold).toBe(2);
  });
});
