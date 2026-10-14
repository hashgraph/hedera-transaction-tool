// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';

const mocks = vi.hoisted(() => ({
  route: {
    query: { group: undefined as string | undefined },
    params: { seq: undefined as string | undefined },
  },
  userStore: { selectedOrganization: null as null | Record<string, unknown> },
  groupStore: { sequential: false },
}));

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mocks.route),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeTransactionGroup', () => ({
  default: vi.fn(() => mocks.groupStore),
}));

vi.mock('@renderer/utils', () => ({
  isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
}));

function mountControls() {
  return mount(TransactionHeaderControls, {
    props: {
      createButtonLabel: 'Create',
      validStart: new Date(),
      submitManually: false,
      reminder: null,
    },
    global: {
      mocks: {
        $route: mocks.route,
        $router: { back: vi.fn() },
      },
      stubs: {
        AppButton: {
          inheritAttrs: false,
          template: '<button v-bind="$attrs"><slot /></button>',
        },
        AppCheckBox: {
          inheritAttrs: false,
          props: ['checked', 'name'],
          template: '<input v-bind="$attrs" type="checkbox" :name="name" :checked="checked" />',
        },
        SaveDraftButton: true,
        AppReminderSelect: true,
      },
    },
  });
}

describe('TransactionHeaderControls.vue', () => {
  beforeEach(() => {
    mocks.route.query = { group: undefined };
    mocks.route.params = { seq: undefined };
    mocks.userStore.selectedOrganization = null;
    mocks.groupStore.sequential = false;
  });

  test('shows the manual-schedule checkbox for a standalone transaction when logged into an organization', () => {
    mocks.userStore.selectedOrganization = {};

    const wrapper = mountControls();

    expect(wrapper.find('input[name="submit-manually"]').exists()).toBe(true);
  });

  test('hides the manual-schedule checkbox when not logged into an organization', () => {
    mocks.userStore.selectedOrganization = null;

    const wrapper = mountControls();

    expect(wrapper.find('input[name="submit-manually"]').exists()).toBe(false);
  });

  test('shows the manual-schedule checkbox when adding to a group that is neither atomic nor sequential', () => {
    mocks.userStore.selectedOrganization = {};
    mocks.route.query = { group: 'true' };
    mocks.groupStore.sequential = false;

    const wrapper = mountControls();

    expect(wrapper.find('input[name="submit-manually"]').exists()).toBe(true);
  });

  test('hides the manual-schedule checkbox when adding to a sequential group', () => {
    mocks.userStore.selectedOrganization = {};
    mocks.route.query = { group: 'true' };
    mocks.groupStore.sequential = true;

    const wrapper = mountControls();

    expect(wrapper.find('input[name="submit-manually"]').exists()).toBe(false);
  });
});
