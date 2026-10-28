// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { KeyList, PrivateKey, PublicKey } from '@hiero-ledger/sdk';

import type { SignatureAudit } from '@renderer/utils';
import SignatureStatus from '@renderer/components/SignatureStatus.vue';

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({ personal: { id: 'user-id', isLoggedIn: true } }),
}));
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => ({ network: 'testnet' }) }));
vi.mock('@renderer/services/accountsService', () => ({ getAll: vi.fn().mockResolvedValue([]) }));

const [keyA, keyB, keyC] = [0, 1, 2].map(() => PrivateKey.generateED25519().publicKey);

const AppPublicKeyNicknameStub = {
  props: ['publicKey', 'signed'],
  template:
    '<span data-testid="key" :data-key="publicKey.toStringRaw ? publicKey.toStringRaw() : publicKey" :class="{ \'text-success\': signed }" />',
};

const audit = (accountKey: KeyList | PublicKey): SignatureAudit => ({
  signatureKeys: [accountKey],
  accountsKeys: { '0.0.1001': accountKey },
  receiverAccountsKeys: {},
  newKeys: [],
  payerKey: {},
  nodeAdminKeys: {},
  newNodeAccountKeys: {},
  externalKeys: new Set<PublicKey>(),
});

const render = (signatureKeyObject: SignatureAudit, signed: PublicKey[]) =>
  mount(SignatureStatus, {
    props: {
      signatureKeyObject,
      publicKeysSigned: signed.map(k => k.toStringRaw()),
      showExternal: false,
    },
    global: { stubs: { AppPublicKeyNickname: AppPublicKeyNicknameStub } },
  });

const keyEl = (wrapper: ReturnType<typeof render>, key: PublicKey) =>
  wrapper.get(`[data-key="${key.toStringRaw()}"]`);

describe('SignatureStatus.vue (multi-signature)', () => {
  const required = new KeyList([keyA, keyB, keyC]);

  test('shows signed keys as complete and unsigned keys as not complete', async () => {
    const wrapper = render(audit(required), [keyA, keyC]);
    await flushPromises();

    expect(keyEl(wrapper, keyA).classes()).toContain('text-success');
    expect(keyEl(wrapper, keyB).classes()).not.toContain('text-success');
    expect(keyEl(wrapper, keyC).classes()).toContain('text-success');
    expect(wrapper.findAll('[data-testid^="span-checkmark-public-key"]')).toHaveLength(2);
  });

  test('threshold is not marked complete until every required key has signed', async () => {
    const wrapper = render(audit(required), [keyA, keyC]);
    await flushPromises();

    expect(wrapper.text()).toContain('Threshold (3 of 3)');
    expect(wrapper.find('[data-testid="span-checkmark-threshold"]').exists()).toBe(false);
  });

  test('threshold is marked complete once all required keys have signed', async () => {
    const wrapper = render(audit(required), [keyA, keyB, keyC]);
    await flushPromises();

    expect(wrapper.find('[data-testid="span-checkmark-threshold"]').exists()).toBe(true);
    for (const key of [keyA, keyB, keyC]) {
      expect(keyEl(wrapper, key).classes()).toContain('text-success');
    }
  });

  test('shows no completed signatures when none are present', async () => {
    const wrapper = render(audit(required), []);
    await flushPromises();

    expect(wrapper.findAll('.text-success')).toHaveLength(0);
    expect(wrapper.find('[data-testid="span-checkmark-threshold"]').exists()).toBe(false);
  });

  test('a threshold key list is complete when enough, but not all, keys have signed', async () => {
    const wrapper = render(audit(new KeyList([keyA, keyB, keyC], 2)), [keyA, keyB]);
    await flushPromises();

    expect(wrapper.text()).toContain('Threshold (2 of 3)');
    expect(wrapper.find('[data-testid="span-checkmark-threshold"]').exists()).toBe(true);
    expect(keyEl(wrapper, keyC).classes()).not.toContain('text-success');
  });
});
