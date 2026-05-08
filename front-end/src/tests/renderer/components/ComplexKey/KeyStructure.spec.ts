// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { KeyList, PublicKey } from '@hiero-ledger/sdk';

import KeyStructure from '@renderer/components/KeyStructure.vue';

vi.mock('@renderer/components/ui/AppPublicKeyNickname.vue', () => ({
  default: { template: '<span class="public-key-nickname" />' },
}));

// A valid DER-encoded ED25519 public key for test use
const PK1 = '302a300506032b6570032100aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const PK2 = '302a300506032b6570032100bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('KeyStructure.vue', () => {
  describe('noThreshold=true', () => {
    it('shows "Key List of 0" header for an empty key list', () => {
      const wrapper = mount(KeyStructure, {
        props: { keyList: new KeyList([]), noThreshold: true },
      });
      expect(wrapper.find('p').text()).toBe('Key List of 0');
    });

    it('shows "Key List of N" header reflecting the number of keys', () => {
      const pk = PublicKey.fromString(PK1);
      const wrapper = mount(KeyStructure, {
        props: { keyList: new KeyList([pk]), noThreshold: true },
      });
      expect(wrapper.find('p').text()).toBe('Key List of 1');
    });

    it('does not render a "Threshold" paragraph', () => {
      const wrapper = mount(KeyStructure, {
        props: { keyList: new KeyList([]), noThreshold: true },
      });
      expect(wrapper.find('p').text()).not.toContain('Threshold');
    });
  });

  describe('noThreshold=false (default)', () => {
    it('shows "Threshold (0 of 0)" for an empty key list', () => {
      const wrapper = mount(KeyStructure, {
        props: { keyList: new KeyList([]) },
      });
      expect(wrapper.find('p').text()).toBe('Threshold (0 of 0)');
    });

    it('shows explicit threshold when it differs from list size', () => {
      const pk1 = PublicKey.fromString(PK1);
      const pk2 = PublicKey.fromString(PK2);
      const keyList = new KeyList([pk1, pk2], 1);
      const wrapper = mount(KeyStructure, {
        props: { keyList, noThreshold: false },
      });
      expect(wrapper.find('p').text()).toBe('Threshold (1 of 2)');
    });

    it('shows listSize as threshold when threshold equals list size', () => {
      const pk1 = PublicKey.fromString(PK1);
      const pk2 = PublicKey.fromString(PK2);
      const keyList = new KeyList([pk1, pk2], 2);
      const wrapper = mount(KeyStructure, {
        props: { keyList, noThreshold: false },
      });
      expect(wrapper.find('p').text()).toBe('Threshold (2 of 2)');
    });

    it('does not render a "Key List" paragraph', () => {
      const wrapper = mount(KeyStructure, {
        props: { keyList: new KeyList([]) },
      });
      expect(wrapper.find('p').text()).not.toContain('Key List');
    });
  });

  describe('public key rendering', () => {
    it('renders one AppPublicKeyNickname per public key in the list', () => {
      const pk1 = PublicKey.fromString(PK1);
      const pk2 = PublicKey.fromString(PK2);
      const wrapper = mount(KeyStructure, {
        props: { keyList: new KeyList([pk1, pk2]), noThreshold: true },
      });
      expect(wrapper.findAll('.public-key-nickname')).toHaveLength(2);
    });
  });
});
