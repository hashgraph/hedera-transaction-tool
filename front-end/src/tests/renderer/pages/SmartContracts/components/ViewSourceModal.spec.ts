// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';

import ViewSourceModal from '@renderer/pages/SmartContracts/components/ViewSourceModal.vue';

const networkState = reactive({ network: 'testnet' });
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => networkState }));

const getVerifiedContractMock = vi.fn();
vi.mock('@renderer/services/sourcifyService', () => ({
  getVerifiedContract: (...args: unknown[]) => getVerifiedContractMock(...args),
}));

const AppModalStub = {
  props: ['show'],
  emits: ['update:show'],
  template: '<div data-testid="modal" :data-show="show"><slot v-if="show" /></div>',
};
const SourceViewerStub = {
  props: ['contractName', 'sources'],
  template: '<div data-testid="source-viewer">{{ contractName }}|{{ sources.length }}</div>',
};

const EVM = '0x' + 'ab'.repeat(20);
const RESULT = {
  name: 'Token',
  match: 'exact_match' as const,
  abi: [],
  sources: [{ path: 'Token.sol', content: 'contract Token {}' }],
};

async function mountModal(show: boolean, evmAddress: string | null) {
  const wrapper = mount(ViewSourceModal, {
    props: { show, evmAddress },
    global: { stubs: { AppModal: AppModalStub, ContractSourceViewer: SourceViewerStub } },
  });
  await flushPromises();
  return wrapper;
}

describe('ViewSourceModal.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    networkState.network = 'testnet';
  });

  test('does nothing while closed', async () => {
    await mountModal(false, EVM);
    expect(getVerifiedContractMock).not.toHaveBeenCalled();
  });

  test('fetches from Sourcify on open and renders the source once resolved', async () => {
    getVerifiedContractMock.mockResolvedValue(RESULT);
    const wrapper = await mountModal(true, EVM);

    expect(getVerifiedContractMock).toHaveBeenCalledWith('testnet', EVM);
    expect(wrapper.find('[data-testid="source-viewer"]').text()).toBe('Token|1');
    expect(wrapper.text()).toContain('Token source code');
  });

  test('shows a loading state while the request is in flight', async () => {
    let resolve!: (v: typeof RESULT) => void;
    getVerifiedContractMock.mockReturnValue(new Promise(r => (resolve = r)));
    const wrapper = await mountModal(true, EVM);

    expect(wrapper.find('[data-testid="text-view-source-loading"]').exists()).toBe(true);
    resolve(RESULT);
    await flushPromises();
    expect(wrapper.find('[data-testid="text-view-source-loading"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-viewer"]').exists()).toBe(true);
  });

  test('shows a failure message when Sourcify has no verified match', async () => {
    getVerifiedContractMock.mockResolvedValue(null);
    const wrapper = await mountModal(true, EVM);

    expect(wrapper.find('[data-testid="text-view-source-failed"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-viewer"]').exists()).toBe(false);
  });

  test('shows a failure message without calling the network when there is no evm address', async () => {
    const wrapper = await mountModal(true, null);

    expect(getVerifiedContractMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="text-view-source-failed"]').exists()).toBe(true);
  });

  test('re-fetches fresh (not cached) every time it is reopened', async () => {
    getVerifiedContractMock.mockResolvedValue(RESULT);
    const wrapper = await mountModal(true, EVM);
    expect(getVerifiedContractMock).toHaveBeenCalledTimes(1);

    await wrapper.setProps({ show: false });
    await flushPromises();
    await wrapper.setProps({ show: true });
    await flushPromises();
    expect(getVerifiedContractMock).toHaveBeenCalledTimes(2);
  });

  test('clicking close emits update:show false', async () => {
    getVerifiedContractMock.mockResolvedValue(RESULT);
    const wrapper = await mountModal(true, EVM);
    await wrapper.find('[data-testid="button-close-view-source"]').trigger('click');
    expect(wrapper.emitted('update:show')).toEqual([[false]]);
  });
});
