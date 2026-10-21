import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import useNetworkStore from '@renderer/stores/storeNetwork';

vi.mock('@renderer/services/mirrorNodeDataService', () => ({ getExchangeRateSet: vi.fn() }));
vi.mock('@renderer/services/transactionService', () => ({ setClient: vi.fn() }));
vi.mock('@renderer/utils', () => ({
  getClientFromMirrorNode: vi.fn(),
  getNodeNumbersFromNetwork: vi.fn(),
}));

describe('storeNetwork custom mirror URL handling', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('normalizes a bare host to an https URL', () => {
    expect(useNetworkStore().normalizeCustomMirrorNodeURL('Mirror.Example.com')).toBe(
      'https://mirror.example.com',
    );
  });

  it.each([
    'http://mirror.example.com',
    'https://user:pw@mirror.example.com',
    'mirror.example.com?x=1',
    'mirror.example.com#frag',
    '',
  ])('rejects %j', value => {
    expect(() => useNetworkStore().normalizeCustomMirrorNodeURL(value)).toThrow();
  });

  it('refuses to resolve a custom host that is not the active network', () => {
    expect(() => useNetworkStore().getMirrorNodeREST('other.example.com')).toThrow();
  });
});
