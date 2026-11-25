// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  user: { selectedOrganization: null, recoveryPhrase: null },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: () => mocks.user }));
vi.mock('@renderer/stores/storeAccountSetup', () => ({ default: () => ({}) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@renderer/composables/useRecoveryPhraseNickname', () => ({
  default: () => ({ set: vi.fn() }),
}));
vi.mock('@renderer/services/keyPairService', () => ({ validateMnemonic: vi.fn() }));
vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => mocks.toast },
}));
vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  isLoggedInOrganization: () => false,
}));

import Generate from '@renderer/pages/AccountSetup/components/Generate.vue';

const stubs = {
  AppButton: { props: ['disabled'], template: '<button v-bind="$attrs"><slot /></button>' },
  AppCheckBox: { template: '<input type="checkbox" />' },
  AppRecoveryPhraseWord: { props: ['word'], template: '<span>{{ word }}</span>' },
  RecoveryPhraseNicknameInput: { template: '<input />' },
};

async function mountWithPhrase() {
  const wrapper = mount(Generate, { props: { handleNext: vi.fn() }, global: { stubs } });
  await wrapper.find('[data-testid="button-next-generate"]').trigger('click');
  await flushPromises();
  return wrapper;
}

describe('AccountSetup Generate.vue - copying the recovery phrase', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mocks.toast.success.mockReset();
    mocks.toast.error.mockReset();
    writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  test('copies the phrase and reports success', async () => {
    writeText.mockResolvedValue(undefined);
    const wrapper = await mountWithPhrase();

    await wrapper.find('[data-testid="button-copy"]').trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0].split(', ')).toHaveLength(24);
    expect(mocks.toast.success).toHaveBeenCalledWith('Recovery phrase copied');
  });

  test('reports an error, not success, when the clipboard write fails', async () => {
    writeText.mockRejectedValue(new Error('Write permission denied.'));
    const wrapper = await mountWithPhrase();

    await wrapper.find('[data-testid="button-copy"]').trigger('click');
    await flushPromises();

    expect(mocks.toast.error).toHaveBeenCalledWith('Write permission denied.');
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });
});
