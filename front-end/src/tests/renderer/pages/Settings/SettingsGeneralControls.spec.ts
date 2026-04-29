// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { Hbar } from '@hiero-ledger/sdk';

import NetworkSettings from '@renderer/pages/Settings/components/GeneralTab/components/NetworkSettings.vue';
import AppearanceSettings from '@renderer/pages/Settings/components/GeneralTab/components/AppearanceSettings.vue';
import MaxTransactionFeeSetting from '@renderer/pages/Settings/components/GeneralTab/components/MaxTransactionFeeSetting.vue';
import DefaultOrganization from '@renderer/pages/Settings/components/GeneralTab/components/DefaultOrganization.vue';
import DateTimeSetting from '@renderer/pages/Settings/components/GeneralTab/components/DateTimeSetting.vue';

const mocks = vi.hoisted(() => ({
  getStoredClaim: vi.fn(),
  setStoredClaim: vi.fn(),
  setDefaultOrganization: vi.fn(),
  setLastOrganization: vi.fn(),
  setDateTimeSetting: vi.fn(),
  networkStore: {
    network: 'testnet',
    setNetwork: vi.fn(async (network: string) => {
      mocks.networkStore.network = network;
    }),
  },
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: { id: 'org-2', nickname: 'Org Two' },
    organizations: [
      { id: 'org-1', nickname: 'Org One' },
      { id: 'org-2', nickname: 'Org Two' },
    ],
  },
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => mocks.networkStore),
}));

vi.mock('@renderer/composables/useLoader', () => ({
  default: vi.fn(() => async (callback: () => Promise<void>) => callback()),
}));

vi.mock('@renderer/services/claimService', () => ({
  getStoredClaim: mocks.getStoredClaim,
  setStoredClaim: mocks.setStoredClaim,
}));

vi.mock('@renderer/composables/user/useDefaultOrganization', () => ({
  default: vi.fn(() => ({
    getDefault: vi.fn(async () => ''),
    setDefault: mocks.setDefaultOrganization,
    setLast: mocks.setLastOrganization,
  })),
}));

vi.mock('@renderer/composables/user/useDateTimeSetting.ts', () => ({
  DateTimeOptions: {
    LOCAL: 'local',
    UTC: 'utc',
  },
  default: vi.fn(() => ({
    DATE_TIME_OPTION_LABELS: [
      { label: 'Local Time', value: 'local' },
      { label: 'UTC Time', value: 'utc' },
    ],
    getDateTimeSetting: vi.fn(async () => 'utc'),
    setDateTimeSetting: mocks.setDateTimeSetting,
  })),
}));

vi.mock('@renderer/utils', () => ({
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
}));

const ButtonGroupStub = {
  props: ['items', 'activeValue'],
  template:
    '<div><button v-for="item in items" :key="item.value" :data-testid="item.id" :class="{ active: item.value === activeValue }" @click="$emit(\'change\', item.value)">{{ item.label }}</button></div>',
};

const AppSelectStub = {
  props: ['items', 'value'],
  template:
    '<div><span data-testid="selected-value">{{ value }}</span><button v-for="item in items" :key="item.value" :data-testid="`option-${item.value || \'none\'}`" @click="$emit(\'update:value\', item.value)">{{ item.label }}</button></div>',
};

const AppInputStub = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue', 'change', 'blur'],
  setup(_props, { emit, expose }) {
    const inputRef = ref<HTMLInputElement | null>(null);
    expose({ inputRef });
    return { emit, inputRef };
  },
  template:
    '<input ref="inputRef" v-bind="$attrs" :value="modelValue" @input="emit(\'update:modelValue\', $event.target.value)" @change="emit(\'change\', $event)" @blur="emit(\'blur\', $event)" />',
});

const AppHbarInputStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template:
    '<input v-bind="$attrs" :value="modelValue?.toTinybars?.().toString?.() || \'\'" @input="$emit(\'update:modelValue\', new Hbar(Number($event.target.value)))" />',
  setup() {
    return { Hbar };
  },
};

describe('settings general controls', () => {
  beforeEach(() => {
    mocks.getStoredClaim.mockReset();
    mocks.getStoredClaim.mockResolvedValue(undefined);
    mocks.setStoredClaim.mockReset();
    mocks.setDefaultOrganization.mockReset();
    mocks.setLastOrganization.mockReset();
    mocks.setDateTimeSetting.mockReset();
    mocks.networkStore.network = 'testnet';
    mocks.networkStore.setNetwork.mockClear();
    mocks.userStore.selectedOrganization = { id: 'org-2', nickname: 'Org Two' };
    mocks.userStore.organizations = [
      { id: 'org-1', nickname: 'Org One' },
      { id: 'org-2', nickname: 'Org Two' },
    ];
  });

  test('renders network options and switches between common networks', async () => {
    const wrapper = mount(NetworkSettings, {
      global: {
        stubs: {
          AppInput: AppInputStub,
          ButtonGroup: ButtonGroupStub,
          Transition: false,
        },
      },
    });

    expect(wrapper.find('[data-testid="tab-network-mainnet"]').text()).toBe('Mainnet');
    expect(wrapper.find('[data-testid="tab-network-testnet"]').text()).toBe('Testnet');
    expect(wrapper.find('[data-testid="tab-network-previewnet"]').text()).toBe('Previewnet');
    expect(wrapper.find('[data-testid="tab-network-local-node"]').text()).toBe('Local Node');
    expect(wrapper.find('[data-testid="tab-network-custom"]').text()).toBe('Custom');

    await wrapper.find('[data-testid="tab-network-previewnet"]').trigger('click');

    expect(mocks.networkStore.setNetwork).toHaveBeenCalledWith('previewnet');
    expect(mocks.setStoredClaim).toHaveBeenCalledWith(
      'local-user-id',
      expect.any(String),
      'previewnet',
    );
  });

  test('shows custom mirror node input and applies formatted URL', async () => {
    const wrapper = mount(NetworkSettings, {
      global: {
        stubs: {
          AppInput: AppInputStub,
          ButtonGroup: ButtonGroupStub,
          Transition: false,
        },
      },
    });

    await wrapper.find('[data-testid="tab-network-custom"]').trigger('click');
    const input = wrapper.find('[data-testid="input-mirror-node-base-url"]');

    expect(input.exists()).toBe(true);

    await input.setValue('https://mainnet-public.mirrornode.hedera.com:443/');
    await input.trigger('blur');

    expect(mocks.networkStore.setNetwork).toHaveBeenCalledWith(
      'mainnet-public.mirrornode.hedera.com',
    );
  });

  test('renders appearance options and toggles selected theme', async () => {
    const unsubscribe = vi.fn();
    (window as any).electronAPI = {
      local: {
        theme: {
          mode: vi.fn(async () => 'light'),
          onThemeUpdate: vi.fn(() => unsubscribe),
          toggle: vi.fn(),
        },
      },
    };

    const wrapper = mount(AppearanceSettings, {
      global: {
        stubs: {
          ButtonGroup: ButtonGroupStub,
        },
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="tab-appearance-light"]').text()).toBe('Light');
    expect(wrapper.find('[data-testid="tab-appearance-dark"]').text()).toBe('Dark');
    expect(wrapper.find('[data-testid="tab-appearance-system"]').text()).toBe('System');

    await wrapper.find('[data-testid="tab-appearance-dark"]').trigger('click');

    expect((window as any).electronAPI.local.theme.toggle).toHaveBeenCalledWith('dark');

    delete (window as any).electronAPI;
  });

  test('updates stored max transaction fee', async () => {
    const wrapper = mount(MaxTransactionFeeSetting, {
      global: {
        stubs: {
          AppHbarInput: AppHbarInputStub,
        },
      },
    });
    await flushPromises();

    await wrapper.find('[data-testid="input-default-max-transaction-fee"]').setValue('5');

    expect(mocks.setStoredClaim).toHaveBeenCalledWith(
      'local-user-id',
      expect.any(String),
      expect.any(String),
    );
  });

  test('selects default organization and None option', async () => {
    const wrapper = mount(DefaultOrganization, {
      global: {
        stubs: {
          AppSelect: AppSelectStub,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Org One');
    expect(wrapper.text()).toContain('None');

    await wrapper.find('[data-testid="option-org-1"]').trigger('click');
    expect(mocks.setDefaultOrganization).toHaveBeenCalledWith('org-1');

    await wrapper.find('[data-testid="option-none"]').trigger('click');
    expect(mocks.setDefaultOrganization).toHaveBeenCalledWith(null);
    expect(mocks.setLastOrganization).toHaveBeenCalledWith('org-2');
  });

  test('selects date and time display format', async () => {
    const wrapper = mount(DateTimeSetting, {
      global: {
        stubs: {
          AppSelect: AppSelectStub,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Local Time');
    expect(wrapper.text()).toContain('UTC Time');

    await wrapper.find('[data-testid="option-local"]').trigger('click');

    expect(mocks.setDateTimeSetting).toHaveBeenCalledWith('local');
  });
});
